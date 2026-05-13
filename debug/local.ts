/**
 * 本地调试工具
 * 用于在本地测试 MiService、MiSpeaker 等核心能力
 */

import { MiService, type MiServiceConfig } from '../src/service.js';
import { MiSpeaker } from '../src/speaker.js';
import { MiMessage } from '../src/message.js';
import { loadConfigFromEnv, printConfigInfo, validateConfig } from './env.js';

// ============ 颜色定义 ============

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

// ============ 日志工具 ============

export const logger = {
  title: (msg: string) => {
    console.log(`\n${colors.bright}${colors.cyan}${'═'.repeat(50)}${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}${msg}${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}${'═'.repeat(50)}${colors.reset}\n`);
  },

  section: (msg: string) => {
    console.log(`\n${colors.bright}${colors.cyan}→ ${msg}${colors.reset}`);
  },

  success: (msg: string, data?: any) => {
    console.log(`${colors.green}✓ ${msg}${colors.reset}`);
    if (data) {
      console.log('  ', data);
    }
  },

  error: (msg: string, err?: any) => {
    console.log(`${colors.red}✗ ${msg}${colors.reset}`);
    if (err) {
      if (typeof err === 'string') {
        console.log('  ', err);
      } else {
        console.log('  ', err.message || JSON.stringify(err));
      }
    }
  },

  warning: (msg: string) => {
    console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`);
  },

  info: (msg: string, data?: any) => {
    console.log(`${colors.cyan}ℹ ${msg}${colors.reset}`);
    if (data) {
      if (typeof data === 'object') {
        console.log(JSON.stringify(data, null, 2));
      } else {
        console.log('  ', data);
      }
    }
  },

  debug: (msg: string, data?: any) => {
    console.log(`${colors.gray}🐛 ${msg}${colors.reset}`);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  },
};

// ============ 调试上下文 ============

export class LocalDebugContext {
  config: MiServiceConfig;
  deviceName: string;
  initialized: boolean = false;

  constructor(config: MiServiceConfig, deviceName: string) {
    this.config = config;
    this.deviceName = deviceName;
  }

  /**
   * 初始化服务
   */
  async init(): Promise<boolean> {
    try {
      logger.section('初始化 MiService');

      const success = await MiService.init(this.config, this.deviceName);

      if (success) {
        this.initialized = true;
        logger.success('MiService 初始化成功');
        return true;
      } else {
        logger.error('MiService 初始化失败');
        return false;
      }
    } catch (err: any) {
      logger.error('初始化异常', err);
      return false;
    }
  }

  /**
   * 诊断服务状态
   */
  async diagnose(): Promise<void> {
    logger.section('服务诊断');

    const status = {
      initialized: this.initialized,
      mina: !!MiService.MiNA,
      miot: !!MiService.MiOT,
      mina_account: MiService.MiNA?.account?.userId,
      miot_account: MiService.MiOT?.account?.did,
    };

    logger.info('服务状态:', status);
  }

  /**
   * 测试 TTS 播放（MiSpeaker）
   */
  async testTts(text: string): Promise<void> {
    logger.section(`测试 TTS 播放: "${text}"`);

    try {
      const result = await MiSpeaker.play({ text });

      if (result.success) {
        logger.success('TTS 播放成功');
      } else {
        logger.error('TTS 播放失败', result.error);
      }
    } catch (err: any) {
      logger.error('TTS 播放异常', err);
    }
  }

  /**
   * 获取当前音量
   */
  async getVolume(): Promise<void> {
    logger.section('获取音量');

    try {
      const volume = await MiSpeaker.getVolume();

      if (volume !== undefined) {
        logger.success(`当前音量: ${volume}%`);
      } else {
        logger.warning('无法获取音量信息');
      }
    } catch (err: any) {
      logger.error('获取音量异常', err);
    }
  }

  /**
   * 设置音量
   */
  async setVolume(volume: number): Promise<void> {
    logger.section(`设置音量: ${volume}%`);

    try {
      const result = await MiSpeaker.setVolume(volume);

      if (result.success) {
        logger.success(`音量已设置为 ${volume}%`);
      } else {
        logger.error('设置音量失败', result.error);
      }
    } catch (err: any) {
      logger.error('设置音量异常', err);
    }
  }

  /**
   * 获取对话历史
   */
  async getConversationHistory(limit: number = 5): Promise<void> {
    logger.section(`获取最近 ${limit} 条对话`);

    try {
      if (!MiService.MiNA) {
        logger.error('MiNA 服务未初始化');
        return;
      }

      const conversations = await MiService.MiNA.getConversations({ limit });

      if (conversations && conversations.records.length > 0) {
        logger.success(`获取到 ${conversations.records.length} 条对话`);

        conversations.records.forEach((record, index) => {
          console.log(`\n  [${index + 1}] 用户: ${record.query}`);
          record.answers.forEach((answer) => {
            const content = answer.tts || answer.url || '(音频内容)';
            console.log(`      小爱: ${content.substring(0, 100)}`);
          });
          console.log(`      时间: ${new Date(record.time).toLocaleString('zh-CN')}`);
        });

        logger.info('', `分页信息: hasMore=${conversations.hasMore}, cursor=${conversations.cursor}`);
      } else {
        logger.warning('暂无对话记录');
      }
    } catch (err: any) {
      logger.error('获取对话历史异常', err);
    }
  }

  /**
   * 获取设备列表
   */
  async getDeviceList(): Promise<void> {
    logger.section('获取设备列表');

    try {
      const devices = await MiService.getDevices(this.config);

      if (devices.length > 0) {
        logger.success(`获取到 ${devices.length} 个设备`);
        devices.forEach((device, index) => {
          console.log(
            `  [${index + 1}] ${device.name} (${device.model}) - ${device.did}`
          );
        });
      } else {
        logger.warning('未找到任何设备');
      }
    } catch (err: any) {
      logger.error('获取设备列表异常', err);
    }
  }

  /**
   * 获取智能家居设备列表（MIoT）
   */
  async getSmartDevices(): Promise<void> {
    logger.section('获取智能家居设备列表 (MIoT)');

    try {
      if (!MiService.MiOT) {
        logger.warning('MIoT 服务未初始化，可能该账号没有 MIoT 设备');
        return;
      }

      const devices = await MiService.MiOT.getDevices();

      if (devices && devices.length > 0) {
        logger.success(`获取到 ${devices.length} 个设备`);
        devices.forEach((device: any, index: number) => {
          console.log(
            `  [${index + 1}] ${device.name} (${device.model}) - Status: ${device.status}`
          );
        });
      } else {
        logger.warning('未找到任何 MIoT 设备');
      }
    } catch (err: any) {
      logger.error('获取 MIoT 设备异常', err);
    }
  }

  /**
   * 测试 MiOT 属性查询
   */
  async testMiotProperty(siid: number, piid: number): Promise<void> {
    logger.section(`测试 MIoT 属性查询 (siid=${siid}, piid=${piid})`);

    try {
      if (!MiService.MiOT) {
        logger.error('MIoT 服务未初始化');
        return;
      }

      const value = await MiService.MiOT.getProperty(siid, piid);
      logger.success(`属性值: ${value}`);
    } catch (err: any) {
      logger.error('属性查询异常', err);
    }
  }

  /**
   * 性能测试
   */
  async performanceTest(operation: string, fn: () => Promise<any>, iterations: number = 5): Promise<void> {
    logger.section(`性能测试: ${operation} (${iterations} 次迭代)`);

    const timings: number[] = [];
    let errors = 0;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      try {
        await fn();
        const duration = performance.now() - start;
        timings.push(duration);
        process.stdout.write('.');
      } catch (err) {
        errors++;
        process.stdout.write('E');
      }
    }

    console.log('\n');

    if (timings.length > 0) {
      const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
      const min = Math.min(...timings);
      const max = Math.max(...timings);

      logger.success('性能测试完成', {
        iterations: timings.length,
        errors,
        avg_ms: avg.toFixed(2),
        min_ms: min.toFixed(2),
        max_ms: max.toFixed(2),
      });
    } else {
      logger.error('性能测试失败，所有迭代均出错');
    }
  }
}

// ============ 快捷函数 ============

/**
 * 初始化 MiService
 * @param config 环境配置
 * @param deviceName 设备名称
 * @returns 初始化是否成功
 */
export async function initMiService(
  config: MiServiceConfig,
  deviceName: string,
): Promise<boolean> {
  logger.section('初始化 MiService');
  try {
    const success = await MiService.init(config, deviceName);
    if (!success) {
      logger.error('初始化失败');
      return false;
    }
    logger.success('初始化成功');
    logger.info('当前设备 ID', MiService.currentDeviceId);
    return true;
  } catch (err: any) {
    logger.error('初始化异常', err.message);
    return false;
  }
}

/**
 * 加载并验证环境配置
 * @returns { config, deviceName, isConfigured }
 */
export function loadAndValidateConfig() {
  const { config, deviceName, isConfigured } = loadConfigFromEnv();

  if (!isConfigured) {
    logger.error('缺少必要的环境变量配置');
    const validation = validateConfig(config, deviceName);
    validation.errors.forEach((err) => logger.error(err));

    logger.info('请设置以下环境变量:');
    console.log(`
      MI_USER_ID         # 小米账号 ID
      MI_PASSWORD        # 小米账号密码
      MI_DEVICE_NAME     # 设备名称
      
      或者使用
      
      MI_PASS_TOKEN      # 小米登录凭证
      MI_DEVICE_NAME     # 设备名称
    `);

    return null;
  }

  printConfigInfo(config, deviceName);
  return { config, deviceName };
}

/**
 * 创建并初始化本地调试上下文
 */
export async function createDebugContext(): Promise<LocalDebugContext | null> {
  const result = loadAndValidateConfig();
  if (!result) return null;

  const { config, deviceName } = result;
  return new LocalDebugContext(config, deviceName);
}

/**
 * 运行完整的诊断
 */
export async function runFullDiagnostics(): Promise<void> {
  logger.title('小米服务完整诊断');

  const ctx = await createDebugContext();
  if (!ctx) return;

  // 初始化
  const initSuccess = await ctx.init();
  if (!initSuccess) return;

  // 诊断
  await ctx.diagnose();

  // 获取设备
  await ctx.getDeviceList();
  await ctx.getSmartDevices();

  // 对话历史
  await ctx.getConversationHistory(3);

  // 音量测试
  await ctx.getVolume();

  logger.title('诊断完成');
}
