import { MiSpeaker } from './speaker.js';
import { MiService } from './service.js';
import { MiMessage } from './message.js';
import { sleep } from './utils/parse.js';
import type { IMessage } from './types.js';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

/**
 * MIoT TTS 保活占位符。
 * 触发 doAction(5, 1, [kAreYouOK]) 让设备保持唤醒状态，不产生可听语音。
 * 等价于原始 MiGPT 的 kAreYouOK 用法。
 */
export const kAreYouOK = "¿ʞо ∩оʎ ǝɹɐ";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/**
 * 会话管理器配置
 */
export interface ConversationConfig {
  /**
   * 唤醒关键词列表。
   * 配置后，只有消息中包含任一关键词才会触发 OpenClaw；
   * 不配置（空数组）则所有消息都会处理。
   */
  wakeWords?: string[];

  /**
   * 退出连续对话的关键词列表。
   * 消息中包含任一词时，会话自动退出 KeepAlive 模式。
   * 示例：["退出", "再见", "拜拜", "关闭对话"]
   */
  exitWords?: string[];

  /**
   * 无新消息多久后自动退出连续对话（秒，默认 30）
   */
  exitKeepAliveAfter?: number;

  /**
   * 进入连续对话时的播报提示语
   * 示例："好的，我在听，请说"
   */
  enterMessage?: string;

  /**
   * 退出连续对话时的播报提示语
   * 示例："好的，退出对话模式"
   */
  exitMessage?: string;

  /**
   * 保活检测循环间隔（毫秒，默认 3000）
   */
  keepAliveInterval?: number;

  /**
   * 连续对话（KeepAlive）期间的消息轮询间隔（毫秒，默认 300）。
   * 进入 KeepAlive 后自动缩短轮询周期，退出后恢复默认 heartbeat。
   */
  keepAliveHeartbeat?: number;

  /**
   * 连续对话首消息回复（代码发出，非 AI 生成）。
   * 仅当唤醒词触发且尚未处于 KeepAlive 时播报，避免每条消息都打断。
   * 默认 false（不开启）。
   */
  firstMessageReply?: boolean;

  /**
   * 首消息回复内容（`firstMessageReply` 开启时生效）。
   * 默认：'收到，正在处理...'
   */
  firstMessageContent?: string;
}

/**
 * 消息过滤结果
 */
export interface MessageCheckResult {
  /** 消息是否应由 OpenClaw 处理（false 则让小爱自己处理） */
  shouldHandle: boolean;
  /** 是否命中了唤醒词 */
  isWake: boolean;
  /** 是否命中了退出词 */
  isExit: boolean;
}

/**
 * startPolling 选项
 */
export interface PollingOptions {
  /** AbortSignal，触发时停止轮询循环 */
  abortSignal: AbortSignal;
  /** 正常状态下的轮询间隔（ms）；KeepAlive 期间自动切换为 keepAliveHeartbeat */
  defaultHeartbeat: number;
  /** 收到新消息且通过过滤时的处理回调 */
  onMessage: (msg: IMessage, checkResult: MessageCheckResult) => Promise<void>;
  /** 消息被过滤跳过时的回调（可选） */
  onSkip?: (msg: IMessage) => void;
  /** 轮询过程中捕获到异常时的回调（可选） */
  onError?: (err: Error) => void;
}

// ─────────────────────────────────────────────
// ConversationManager
// ─────────────────────────────────────────────

/**
 * 会话管理器
 *
 * 职责：
 * 1. **唤醒词过滤**：配置 `wakeWords` 后，只有命中唤醒词的消息才转发给 OpenClaw，
 *    未命中的消息由小爱自行处理。
 * 2. **连续对话 KeepAlive**：一次唤醒后进入 KeepAlive 状态，后续消息无需再说唤醒词；
 *    超时（`exitKeepAliveAfter` 秒）或说出退出词后自动退出。
 * 3. **保活循环**：KeepAlive 期间定时播放静音音频，防止音箱自动闭麦/休眠。
 */
export class ConversationManager {
  readonly deviceId: string;

  private _cfg: Required<ConversationConfig>;

  /** 是否处于连续对话（KeepAlive）状态 */
  private _keepAlive = false;

  /** AI 是否正在响应中（响应期间不播放保活静音） */
  private _responding = false;

  /** 超时自动退出计时器 */
  private _exitTimer?: ReturnType<typeof setTimeout>;

  /** 保活循环终止控制器 */
  private _loopAbort?: AbortController;

  constructor(deviceId: string, config: ConversationConfig = {}) {
    this.deviceId = deviceId;
    this._cfg = {
      wakeWords: config.wakeWords ?? [],
      exitWords: config.exitWords ?? [],
      exitKeepAliveAfter: config.exitKeepAliveAfter ?? 30,
      enterMessage: config.enterMessage ?? '',
      exitMessage: config.exitMessage ?? '',
      keepAliveInterval: config.keepAliveInterval ?? 3000,
      keepAliveHeartbeat: config.keepAliveHeartbeat ?? 300,
      firstMessageReply: config.firstMessageReply ?? false,
      firstMessageContent: config.firstMessageContent ?? '收到，正在处理...',
    };
  }

  // ─────────── Getters ───────────

  get keepAlive(): boolean {
    return this._keepAlive;
  }

  get responding(): boolean {
    return this._responding;
  }

  /**
   * 返回当前应使用的消息轮询间隔。
   * - 处于 KeepAlive 状态：返回 `keepAliveHeartbeat`（默认 300ms），以缩短响应延迟
   * - 普通状态：返回传入的 `defaultHeartbeat`（即 channel 配置的 heartbeat）
   */
  getHeartbeat(defaultHeartbeat: number): number {
    return this._keepAlive ? this._cfg.keepAliveHeartbeat : defaultHeartbeat;
  }

  /**
   * 构建注入给 AI 的动态上下文信息字符串（每条消息独立构建）。
   * 仅包含每次消息的动态数据：设备、输入渠道、时间、KeepAlive 状态等。
   *
   * 注：渠道感知规范和播报规范已通过 agentPrompt 以 system prompt 级别注入，
   * 此处不再重复，避免降低规范优先级。
   */
  buildContextInfo(msg: IMessage): string {
    const parts = [
      '【会话上下文】',
      `- 设备：${this.deviceId}`,
      `- 输入渠道：音箱（语音输入）`,
      `- 消息 ID: ${this.deviceId}-${msg.timestamp}`,
      `- 当前时间：${new Date(msg.timestamp).toLocaleString('zh-CN')}`,
    ];
    if (this._keepAlive) {
      parts.push('- 对话模式：连续对话（KeepAlive）');
    }
    return parts.join('\n');
  }

  /**
   * 完整处理一条消息的生命周期，供 channel 层调用：
   * 1. `checkMessage` — 唤醒词/KeepAlive 过滤
   * 2. 未命中 → 调用 `onSkip`（可选）后直接返回
   * 3. 命中   → `setResponding(true)` → 执行 `handler` → `setResponding(false)`
   * 4. `onAfterHandled` — 更新 KeepAlive 状态
   *
   * channel 层只需关注消息内容的分发逻辑，无需手动维护会话状态。
   */
  async handleMessage(
    msg: IMessage,
    handler: (msg: IMessage, checkResult: MessageCheckResult) => Promise<void>,
    onSkip?: (msg: IMessage) => void,
  ): Promise<void> {
    const checkResult = this.checkMessage(msg);
    if (!checkResult.shouldHandle) {
      onSkip?.(msg);
      return;
    }

    // 首消息回复：唤醒词触发且尚未进入 KeepAlive 时，在 AI 处理前播报提示
    if (this._cfg.firstMessageReply && checkResult.isWake && !this._keepAlive) {
      await MiSpeaker.play({ text: this._cfg.firstMessageContent }).catch(() => {});
    }

    this.setResponding(true);
    try {
      await handler(msg, checkResult);
    } finally {
      this.setResponding(false);
    }

    await this.onAfterHandled(checkResult);
  }

  /**
   * 启动消息轮询循环，阻塞直到 `abortSignal` 触发。
   *
   * 内部逻辑：
   * - 每轮通过 `MiMessage.fetchNextMessage` 拉取新消息
   * - 有新消息时调用 `handleMessage`（含过滤、响应标记、KeepAlive 更新）
   * - 每轮结束后 `sleep(getHeartbeat(defaultHeartbeat))`，KeepAlive 期间自动缩短间隔
   * - 捕获到异常时调用 `onError` 回调（可选），不中断循环
   */
  async startPolling(options: PollingOptions): Promise<void> {
    const { abortSignal, defaultHeartbeat, onMessage, onSkip, onError } = options;

    while (!abortSignal.aborted) {
      try {
        const msg = await MiMessage.fetchNextMessage(this.deviceId);
        if (msg) {
          await this.handleMessage(msg, onMessage, onSkip);
        }
      } catch (err) {
        onError?.(err instanceof Error ? err : new Error(String(err)));
      }
      await sleep(this.getHeartbeat(defaultHeartbeat));
    }
  }

  // ─────────── Public API ───────────

  /**
   * 热更新配置（不影响当前 KeepAlive 运行状态）
   */
  updateConfig(config: Partial<ConversationConfig>): void {
    this._cfg = { ...this._cfg, ...config };
  }

  /**
   * 检查消息是否需要由 OpenClaw 处理，并返回命中详情。
   *
   * 判断规则：
   * - 处于 KeepAlive → 所有消息都处理（包括退出词）
   * - 未配置唤醒词   → 所有消息都处理（全量模式）
   * - 普通模式       → 仅命中唤醒词的消息处理
   */
  checkMessage(msg: IMessage): MessageCheckResult {
    const text = msg.text.toLowerCase();
    const isWake = this._cfg.wakeWords.length > 0
      && this._cfg.wakeWords.some((w) => text.includes(w.toLowerCase()));
    const isExit = this._cfg.exitWords.length > 0
      && this._cfg.exitWords.some((w) => text.includes(w.toLowerCase()));

    let shouldHandle: boolean;
    if (this._keepAlive) {
      // KeepAlive 状态下全部处理（exit 词也需要处理，让 OpenClaw 感知退出）
      shouldHandle = true;
    } else if (this._cfg.wakeWords.length === 0) {
      // 未配置唤醒词 → 全量处理
      shouldHandle = true;
    } else {
      // 普通模式 → 仅唤醒词触发
      shouldHandle = isWake;
    }

    return { shouldHandle, isWake, isExit };
  }

  /**
   * 标记 AI 响应状态。
   * - `true`：AI 正在回复，保活循环暂停播放静音，避免打断语音
   * - `false`：AI 回复完毕，保活循环恢复
   */
  setResponding(value: boolean): void {
    this._responding = value;
  }

  /**
   * 进入连续对话（KeepAlive）模式。
   * 若已处于 KeepAlive，则只重置超时计时器。
   */
  async enterKeepAlive(): Promise<void> {
    if (this._keepAlive) {
      this._resetExitTimer();
      return;
    }

    this._keepAlive = true;
    this._startKeepAliveLoop();
    this._resetExitTimer();

    if (this._cfg.enterMessage) {
      await MiSpeaker.play({ text: this._cfg.enterMessage });
    }
  }

  /**
   * 退出连续对话模式，停止保活循环并清理计时器。
   */
  async exitKeepAlive(): Promise<void> {
    if (!this._keepAlive) return;

    this._keepAlive = false;
    this._clearExitTimer();
    this._stopKeepAliveLoop();

    if (this._cfg.exitMessage) {
      await MiSpeaker.play({ text: this._cfg.exitMessage });
    }
  }

  /**
   * 在 OpenClaw 处理完一条消息后调用，根据结果更新 KeepAlive 状态。
   *
   * - 命中退出词 + 处于 KeepAlive → 退出
   * - 命中唤醒词 或 处于 KeepAlive → 进入/续期 KeepAlive
   */
  async onAfterHandled(result: MessageCheckResult): Promise<void> {
    if (!result.shouldHandle) return;

    if (result.isExit && this._keepAlive) {
      await this.exitKeepAlive();
    } else if (result.isWake || this._keepAlive) {
      await this.enterKeepAlive();
    }
  }

  /**
   * 释放资源，停止所有计时器和循环（设备停止轮询时调用）
   */
  dispose(): void {
    this._clearExitTimer();
    this._stopKeepAliveLoop();
    this._keepAlive = false;
    this._responding = false;
  }

  // ─────────── Private ───────────

  private _resetExitTimer(): void {
    this._clearExitTimer();
    const delay = this._cfg.exitKeepAliveAfter * 1000;
    this._exitTimer = setTimeout(async () => {
      // 超时时仍在 KeepAlive 且 AI 不在响应中 → 自动退出
      if (this._keepAlive && !this._responding) {
        await this.exitKeepAlive();
      }
    }, delay);
  }

  private _clearExitTimer(): void {
    if (this._exitTimer) {
      clearTimeout(this._exitTimer);
      this._exitTimer = undefined;
    }
  }

  private _startKeepAliveLoop(): void {
    if (this._loopAbort) return;
    this._loopAbort = new AbortController();
    this._runKeepAliveLoop(this._loopAbort.signal).catch(() => {});
  }

  private _stopKeepAliveLoop(): void {
    if (this._loopAbort) {
      this._loopAbort.abort();
      this._loopAbort = undefined;
    }
  }

  /**
   * 保活循环：KeepAlive 期间，每隔 `keepAliveInterval` 毫秒：
   * - 若 AI 未在响应，且配置了 `audioSilent`，则播放静音音频
   * - 防止音箱自动进入休眠状态
   */
  private async _runKeepAliveLoop(signal: AbortSignal): Promise<void> {
    const interval = this._cfg.keepAliveInterval;
    while (!signal.aborted && this._keepAlive) {
      if (!this._responding) {
        // 没有回复时，通过 MIoT TTS 动作保持设备唤醒状态
        // 等价于原始 MiGPT 的 doAction(...ttsCommand, kAreYouOK)
        await MiService.MiOT?.doAction(5, 1, [kAreYouOK]).catch(() => {});
      }
      await sleep(interval);
    }
  }
}

// ─────────────────────────────────────────────
// Factory：单设备单实例
// ─────────────────────────────────────────────

const _instances = new Map<string, ConversationManager>();

/**
 * 获取指定设备的 ConversationManager（不存在则创建，已存在则热更新配置）
 */
export function getConversationManager(
  deviceId: string,
  config?: ConversationConfig,
): ConversationManager {
  if (!_instances.has(deviceId)) {
    _instances.set(deviceId, new ConversationManager(deviceId, config ?? {}));
  } else if (config) {
    _instances.get(deviceId)!.updateConfig(config);
  }
  return _instances.get(deviceId)!;
}

/**
 * 释放指定设备的 ConversationManager（设备下线时调用）
 */
export function disposeConversationManager(deviceId: string): void {
  const mgr = _instances.get(deviceId);
  if (mgr) {
    mgr.dispose();
    _instances.delete(deviceId);
  }
}
