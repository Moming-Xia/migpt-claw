import type { ChannelPlugin } from 'openclaw/plugin-sdk';
import { DEFAULT_ACCOUNT_ID } from 'openclaw/plugin-sdk';
import type { ResolvedMiAccount, ExtendedOpenClawConfig } from './types.js';
import {
  resolveMiAccount,
  listMiAccountIds,
  resolveDefaultMiAccountId,
  setMiAccountEnabled,
  deleteMiAccount,
  resolveMiAllowFrom,
  formatMiAllowFrom,
} from './config.js';
import { miOutbound } from './outbound.js';
import { miGPTOnboardingAdapter } from './onboarding.js';
import { MiService } from './service.js';
import { Debugger } from './utils/debug.js';
import { MiSpeaker } from './speaker.js';
import { getMiGPTRuntime } from './runtime.js';
import { getConversationManager, disposeConversationManager } from './conversation.js';

const meta = {
  id: 'migpt',
  label: 'MiGPT',
  selectionLabel: '小米音箱 (MiGPT)',
  docsPath: '/channels/migpt',
  docsLabel: 'migpt',
  blurb: '小米小爱音箱语音对话。',
  aliases: ['xiaomi', 'mico'],
  order: 60,
};

export const miGPTPlugin: ChannelPlugin<ResolvedMiAccount> = {
  id: 'migpt',
  meta: {
    ...meta,
  },
  capabilities: {
    chatTypes: ['direct'],
    polls: false,
    threads: false,
    media: true,
    reactions: false,
    edit: false,
    reply: false,
    blockStreaming: false,
  },
  reload: { configPrefixes: ['channels.migpt'] },
  onboarding: miGPTOnboardingAdapter,

  // Agent Prompt 配置：将渠道感知规范作为 system prompt 级别注入给 OpenClaw（播报规范在 skill 工具描述中）
  agentPrompt: {
    description: '渠道感知规范',
    getConfig: (cfg: any) => {
      const migptCfg = cfg.channels?.migpt;

      // 渠道感知规范（system prompt 级别）
      // 具体的播报规范放在 migpt-speaker-control skill 的工具描述中，避免污染全局上下文
      const BASE_SYSTEM_PROMPT = `【渠道感知规范 - 必须遵守】
1. 当用户通过音箱输入时，优先使用语音对话进行输出
2. 当用户通过非音箱渠道输入时，降低语音输出优先级，避免打扰用户
3. 当主动调用音箱控制技能（migpt-speaker-control）操作设备时，优先通过语音播报通知用户`;

      // 用户自定义 systemPrompt 追加在基础规范之后
      const customPrompt = migptCfg?.systemPrompt;
      const systemPrompt = customPrompt
        ? `${BASE_SYSTEM_PROMPT}\n\n${customPrompt}`
        : BASE_SYSTEM_PROMPT;

      return {
        enabled: true,
        systemPrompt,
      };
    },
    applyConfig: (cfg: any, updates: any) => {
      const nextCfg = { ...cfg } as ExtendedOpenClawConfig;
      const nextMigpt = { ...nextCfg.channels?.migpt };
      if (updates.systemPrompt !== undefined) {
        nextMigpt.systemPrompt = updates.systemPrompt;
      }
      nextCfg.channels = { ...nextCfg.channels, migpt: nextMigpt };
      return nextCfg;
    },
  },

  config: {
    listAccountIds: (cfg) => listMiAccountIds(cfg as unknown as ExtendedOpenClawConfig),
    resolveAccount: (cfg, accountId) =>
      resolveMiAccount(cfg as unknown as ExtendedOpenClawConfig, accountId),
    defaultAccountId: (cfg) => resolveDefaultMiAccountId(cfg as unknown as ExtendedOpenClawConfig),
    setAccountEnabled: ({ cfg, accountId, enabled }) =>
      setMiAccountEnabled(cfg as unknown as ExtendedOpenClawConfig, accountId, enabled),
    deleteAccount: ({ cfg, accountId }) =>
      deleteMiAccount(cfg as unknown as ExtendedOpenClawConfig, accountId),
    isConfigured: (account) => account.configured,
    describeAccount: (account) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
      name: account.name,
      devices: account.devices,
    }),
    resolveAllowFrom: ({ cfg, accountId }: { cfg: any; accountId?: string }) =>
      resolveMiAllowFrom(cfg as unknown as ExtendedOpenClawConfig, accountId),
    formatAllowFrom: ({ allowFrom }: { allowFrom: Array<string | number> }) => formatMiAllowFrom(allowFrom),
  },

  setup: {
    resolveAccountId: ({ accountId }: { accountId?: string }) => accountId?.trim().toLowerCase() || DEFAULT_ACCOUNT_ID,
    applyAccountConfig: ({ cfg, accountId, input }: { cfg: any; accountId?: string; input: any }) => {
      const migptCfg = cfg.channels?.migpt ?? {};
      const accountConfig = {
        userId: input.userId,
        password: input.password,
        passToken: input.passToken,
        devices: input.devices,
        enabled: true,
      };

      const isDefault = !accountId || accountId === DEFAULT_ACCOUNT_ID;

      if (isDefault) {
        return {
          ...cfg,
          channels: {
            ...cfg.channels,
            migpt: {
              ...migptCfg,
              ...accountConfig,
            },
          },
        } as ExtendedOpenClawConfig;
      }

      return {
        ...cfg,
        channels: {
          ...cfg.channels,
          migpt: {
            ...migptCfg,
            accounts: {
              ...migptCfg.accounts,
              [accountId]: accountConfig,
            },
          },
        },
      } as ExtendedOpenClawConfig;
    },
    validateInput: ({ input }: { input: any }) => {
      if (!input.userId) {
        return '小米 ID (userId) 是必需的';
      }
      if (!input.passToken && !input.password) {
        return '需要提供 passToken 或 password';
      }
      return null;
    },
  },

  messaging: {
    normalizeTarget: (target: string) => {
      // 支持格式：migpt:客厅音箱 或 客厅音箱
      let id = target.replace(/^migpt:/i, '');
      if (id.trim()) {
        return { ok: true, to: id.trim() };
      }
      return { ok: false, error: 'Invalid target format' };
    },
    targetResolver: {
      looksLikeId: (id: string): boolean => {
        // 简单的启发式判断：非空字符串
        return id.length > 0 && id.length < 100;
      },
      hint: 'MiGPT 目标格式：设备名称（如：客厅音箱）',
    },
  },

  outbound: miOutbound,

  gateway: {
    startAccount: async (ctx) => {
      const { account, abortSignal, log, cfg } = ctx;

      log?.info(`[migpt:${account.accountId}] Starting gateway`);

      if (!account.configured) {
        log?.error(`[migpt:${account.accountId}] Account not configured`);
        return;
      }

      // 获取设备列表
      const devices = account.devices;
      if (devices.length === 0) {
        log?.error(`[migpt:${account.accountId}] No devices configured`);
        return;
      }

      // 为每个设备启动轮询
      const devicePromises = devices.map(async (deviceName: string) => {
        log?.info(`[migpt:${account.accountId}] Starting poller for device: ${deviceName}`);

        // 初始化会话管理器
        const convMgr = getConversationManager(deviceName, {
          wakeWords: account.config.wakeWords,
          exitWords: account.config.exitWords,
          exitKeepAliveAfter: account.config.exitKeepAliveAfter,
          enterMessage: account.config.enterMessage,
          exitMessage: account.config.exitMessage,
          keepAliveInterval: account.config.keepAliveInterval,
          keepAliveHeartbeat: account.config.keepAliveHeartbeat,
          firstMessageReply: account.config.firstMessageReply,
          firstMessageContent: account.config.firstMessageContent,
        });

        // 初始化服务（传递启动播报配置）
        const initSuccess = await MiService.init({
          ...account.config,
          announceOnStart: account.config.announceOnStart ?? cfg.channels?.migpt?.announceOnStart,
          startupMessage: account.config.startupMessage ?? cfg.channels?.migpt?.startupMessage,
        }, deviceName);
        if (!initSuccess) {
          log?.error(`[migpt:${account.accountId}] Failed to initialize device: ${deviceName}`);
          return;
        }

        // 设置调试模式和音箱控制方式
        Debugger.debug = account.config.debug ?? false;

        // 更新状态
        ctx.setStatus({
          ...ctx.getStatus(),
          running: true,
          connected: true,
          lastConnectedAt: Date.now(),
        });

        // 获取轮询间隔
        const heartbeat = cfg.channels?.migpt?.heartbeat ?? 1000;

        // 启动轮询（阻塞直到 abortSignal 触发）
        await convMgr.startPolling({
          abortSignal,
          defaultHeartbeat: heartbeat,
          onMessage: async (msg) => {
            log?.info(`[migpt:${account.accountId}] Received message from ${deviceName}: ${msg.text.slice(0, 50)}...`);

            // 记录活动
            const pluginRuntime = getMiGPTRuntime();
            pluginRuntime.channel.activity.record({
              channel: 'migpt',
              accountId: account.accountId,
              direction: 'inbound',
            });

            // 构建路由
            const fromAddress = `migpt:${deviceName}`;
            const toAddress = `migpt:${account.accountId}`;
            const sessionKey = `${account.accountId}:${deviceName}`;

            // 构建消息体
            const envelopeOptions = pluginRuntime.channel.reply.resolveEnvelopeFormatOptions(cfg);
            const body = pluginRuntime.channel.reply.formatInboundEnvelope({
              Body: msg.text,
              BodyForAgent: msg.text,
              From: fromAddress,
              To: toAddress,
              SessionKey: sessionKey,
              ChatType: 'direct',
              SenderId: deviceName,
              SenderName: deviceName,
              Provider: 'migpt',
              Surface: 'migpt',
              MessageSid: `${deviceName}-${msg.timestamp}`,
              Timestamp: msg.timestamp,
              OriginatingChannel: 'migpt',
              envelopeOptions,
            });

            // 构建 AI 看到的动态上下文（设备信息 + KeepAlive 状态 + 用户输入）
            // 注：渠道感知规范和播报规范已通过 agentPrompt 注入为 system prompt，此处只传每次消息的动态数据
            const contextInfo = convMgr.buildContextInfo(msg);
            const agentBody = `${contextInfo}\n\n${msg.text}`;

            // 构建上下文
            const ctxPayload = pluginRuntime.channel.reply.finalizeInboundContext({
              Body: body,
              BodyForAgent: agentBody,
              RawBody: msg.text,
              CommandBody: msg.text,
              From: fromAddress,
              To: toAddress,
              SessionKey: sessionKey,
              AccountId: account.accountId,
              ChatType: 'direct',
              SenderId: deviceName,
              SenderName: deviceName,
              Provider: 'migpt',
              Surface: 'migpt',
              MessageSid: `${deviceName}-${msg.timestamp}`,
              Timestamp: msg.timestamp,
              OriginatingChannel: 'migpt',
              OriginatingTo: toAddress,
              CommandAuthorized: true,
            });

            // 分派消息到 OpenClaw
            await pluginRuntime.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
              ctx: ctxPayload,
              cfg,
              dispatcherOptions: {
                responsePrefix: '',
                deliver: async (payload: { text?: string; mediaUrls?: string[]; mediaUrl?: string }, info: { kind: string }) => {
                  log?.info(`[migpt:${account.accountId}] deliver called, kind: ${info.kind}`);
                  if (payload.text) {
                    convMgr.replying = true;
                    await MiSpeaker.play({ text: payload.text });
                    convMgr.replying = false;
                  }
                },
              },
            });
            convMgr.setResponding(false);
          },
          onSkip: (msg) => {
            // 未命中唤醒词且非 KeepAlive 状态，跳过，由小爱自行处理
            log?.info(`[migpt:${account.accountId}] Skipped (no wake word): "${msg.text.slice(0, 30)}"`);
          },
          onError: (err) => {
            log?.error(`[migpt:${account.accountId}] Error polling messages: ${err.message}`);
            ctx.setStatus({
              ...ctx.getStatus(),
              lastError: err.message,
            });
          },
        });

        // 设备停止轮询时释放会话管理器资源
        disposeConversationManager(deviceName);
        log?.info(`[migpt:${account.accountId}] Stopping poller for device: ${deviceName}`);
      });

      await Promise.all(devicePromises);
    },
  },

  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      connected: false,
      lastConnectedAt: null,
      lastError: null,
      lastInboundAt: null,
      lastOutboundAt: null,
    },
    buildChannelSummary: ({ snapshot }: { snapshot: any }) => ({
      configured: snapshot.configured ?? false,
      running: snapshot.running ?? false,
      connected: snapshot.connected ?? false,
      lastConnectedAt: snapshot.lastConnectedAt ?? null,
      lastError: snapshot.lastError ?? null,
    }),
    buildAccountSnapshot: ({ account, runtime }: { account: any; runtime: any }) => ({
      accountId: account?.accountId ?? DEFAULT_ACCOUNT_ID,
      name: account?.name,
      enabled: account?.enabled ?? false,
      configured: Boolean(account?.configured),
      devices: account?.devices,
      running: runtime?.running ?? false,
      connected: runtime?.connected ?? false,
      lastConnectedAt: runtime?.lastConnectedAt ?? null,
      lastError: runtime?.lastError ?? null,
      lastInboundAt: runtime?.lastInboundAt ?? null,
      lastOutboundAt: runtime?.lastOutboundAt ?? null,
    }),
  },
};
