/**
 * 完整诊断测试脚本
 * 
 * 使用方式：
 *   npx ts-node debug/test-full.ts
 */

import './load-env.js';
import { MiService } from '../src/service.js';
import { MiSpeaker } from '../src/speaker.js';
import { MiMessage } from '../src/message.js';
import { initMiService, loadAndValidateConfig, logger } from './local.js';

async function main() {
  logger.title('MiGPT 完整诊断和测试');

  // 加载并验证配置
  const result = loadAndValidateConfig();
  if (!result) return;

  const { config, deviceName } = result;

  // ============ Step 1: 初始化 ============

  logger.section('Step 1: 服务初始化');
  if (!(await initMiService(config, deviceName))) {
    logger.error('初始化失败，无法继续');
    return;
  }

  // ============ Step 2: 服务诊断 ============

  logger.section('Step 2: 服务诊断');
  const status = {
    initialized: true,
    mina: !!MiService.MiNA,
    miot: !!MiService.MiOT,
    mina_account: MiService.MiNA?.account?.userId,
    miot_account: MiService.MiOT?.account?.did,
  };
  logger.info('服务状态:', status);

  // ============ Step 3: 基础功能测试 ============

  logger.section('Step 3: 基础功能测试');

  // 3.1 音量测试
  logger.section('3.1 音量测试');
  try {
    const volume = await MiSpeaker.getVolume();
    logger.success(`当前音量: ${volume}%`);
  } catch (err: any) {
    logger.error('获取音量失败', err.message);
  }

  // 3.2 TTS 播放测试
  logger.section('3.2 TTS 播放测试');
  try {
    const result = await MiSpeaker.play({ text: '小龙虾上线了，开始服务！' });
    if (result.success) {
      logger.success('TTS 播放成功');
    } else {
      logger.error('TTS 播放失败', result.error);
    }
  } catch (err: any) {
    logger.error('TTS 播放异常', err.message);
  }

  // ============ Step 4: 设备信息 ============

  logger.section('Step 4: 设备信息采集');

  // 4.1 音箱设备列表
  try {
    const devices = await MiService.getDevices(config);
    if (devices.length > 0) {
      logger.success(`获取到 ${devices.length} 个设备`);
    } else {
      logger.warning('未找到任何设备');
    }
  } catch (err: any) {
    logger.error('获取音箱设备列表失败', err.message);
  }

  // 4.2 智能家居设备
  try {
    if (MiService.MiOT) {
      const devices = await MiService.MiOT.getDevices();
      if (devices && devices.length > 0) {
        logger.success(`获取到 ${devices.length} 个 MIoT 设备`);
      } else {
        logger.warning('未找到任何 MIoT 设备');
      }
    } else {
      logger.warning('MIoT 服务未初始化');
    }
  } catch (err: any) {
    logger.error('获取 MIoT 设备失败', err.message);
  }

  // ============ Step 5: 对话历史 ============

  logger.section('Step 5: 对话历史查询');
  try {
    const deviceId = MiService.currentDeviceId;
    const messages = await MiMessage.getHistoryMessages(deviceId, 5);
    if (messages.length > 0) {
      logger.success(`获取到 ${messages.length} 条对话`);
      console.log(messages);
    } else {
      logger.warning('暂无对话记录');
    }
  } catch (err: any) {
    logger.error('获取对话历史失败', err.message);
  }

  // ============ Step 6: 高级功能测试 ============

  logger.section('Step 6: 高级功能测试');

  // 6.1 播放暂停测试
  logger.section('6.1 播放控制测试');
  try {
    const pauseResult = await MiSpeaker.pause();
    if (pauseResult.success) {
      logger.success('暂停命令发送成功');
    } else {
      logger.warning('暂停命令失败: ' + pauseResult.error);
    }
  } catch (err: any) {
    logger.warning('暂停命令异常: ' + err.message);
  }

  // 6.2 播放恢复测试
  logger.section('6.2 播放恢复测试');
  try {
    const playResult = await MiSpeaker.playOrPause();
    if (playResult.success) {
      logger.success('播放切换命令发送成功');
    } else {
      logger.warning('播放切换命令失败: ' + playResult.error);
    }
  } catch (err: any) {
    logger.warning('播放切换命令异常: ' + err.message);
  }

  // ============ Step 7: 性能基准 ============

  logger.section('Step 7: 性能基准测试');

  const benchmarks = [
    {
      name: '获取音量',
      fn: async () => {
        await MiSpeaker.getVolume();
      },
    },
    {
      name: '获取设备列表',
      fn: async () => {
        if (MiService.MiOT) {
          await MiService.MiOT.getDevices();
        }
      },
    },
    {
      name: '获取对话历史',
      fn: async () => {
        if (MiService.MiNA) {
          await MiService.MiNA.getConversations({ limit: 5 });
        }
      },
    },
  ];

  for (const benchmark of benchmarks) {
    try {
      const timings: number[] = [];
      logger.info(`性能测试: ${benchmark.name} (3 次迭代)`);

      for (let i = 0; i < 3; i++) {
        const start = performance.now();
        await benchmark.fn();
        const duration = performance.now() - start;
        timings.push(duration);
        process.stdout.write('.');
      }

      console.log('\n');
      const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
      const min = Math.min(...timings);
      const max = Math.max(...timings);

      logger.success('性能测试完成', {
        operation: benchmark.name,
        iterations: 3,
        avg_ms: avg.toFixed(2),
        min_ms: min.toFixed(2),
        max_ms: max.toFixed(2),
      });
    } catch (err: any) {
      logger.error(`${benchmark.name} 性能测试失败`, err.message);
    }
  }

  // ============ Step 8: 生成诊断报告 ============

  logger.section('Step 8: 诊断报告');

  const report = {
    timestamp: new Date().toISOString(),
    config: {
      userId: MiService.MiNA?.account?.userId || 'unknown',
      deviceName: deviceName,
      debugMode: config.debug,
      speakerControl: config.speakerControl,
    },
    services: {
      mina: !!MiService.MiNA,
      miot: !!MiService.MiOT,
    },
    status: 'success',
  };

  logger.success('诊断完成！');
  logger.info('诊断报告:', report);

  logger.title('完整诊断完成');
}

main()
  .then(() => {
    logger.success('✅ 脚本执行完成');
    process.exit(0);
  })
  .catch((err) => {
    logger.error('发生错误', err);
    process.exit(1);
  });
