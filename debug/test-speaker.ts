/**
 * 音箱 (MiSpeaker) 功能测试脚本
 * 
 * 使用方式：
 *   npx ts-node debug/test-speaker.ts
 */

import './load-env.js';
import { MiSpeaker } from '../src/speaker.js';
import { MiMessage } from '../src/message.js';
import { MiService } from '../src/service.js';
import { initMiService, loadAndValidateConfig, logger } from './local.js';

async function main() {
  logger.title('小爱音箱功能测试');

  // 加载并验证配置
  const result = loadAndValidateConfig();
  if (!result) return;

  const { config, deviceName } = result;

  // 初始化
  if (!(await initMiService(config, deviceName))) {
    return;
  }

  const deviceId = MiService.currentDeviceId;

  // ============ 音量相关 ============

  logger.section('测试 1: 音量操作');
  try {
    const volume = await MiSpeaker.getVolume();
    logger.success(`当前音量: ${volume}%`);

    const setResult = await MiSpeaker.setVolume(60);
    if (setResult.success) {
      logger.success('音量已设置为 60%');
      const newVolume = await MiSpeaker.getVolume();
      logger.success(`新音量: ${newVolume}%`);
    } else {
      logger.error('设置音量失败', setResult.error);
    }
  } catch (err: any) {
    logger.error('音量测试异常', err.message);
  }

  // ============ TTS 播放 ============

  logger.section('测试 2: TTS 播放');
  try {
    const result1 = await MiSpeaker.play({ text: '你好，我是小龙虾，为您服务！' });
    if (result1.success) {
      logger.success('第一条消息播放成功');
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } else {
      logger.error('播放失败', result1.error);
    }

    const result2 = await MiSpeaker.play({ text: '这是第二条测试消息' });
    if (result2.success) {
      logger.success('第二条消息播放成功');
    } else {
      logger.error('播放失败', result2.error);
    }
  } catch (err: any) {
    logger.error('播放测试异常', err.message);
  }

  // ============ 对话历史 ============

  logger.section('测试 3: 对话历史');
  try {
    const messages = await MiMessage.getHistoryMessages(deviceId, 10);
    if (messages.length > 0) {
      logger.success(`获取到 ${messages.length} 条对话`);
      messages.slice(0, 3).forEach((msg, i) => {
        console.log(
          `  [${i + 1}] ${msg.text} (${new Date(msg.timestamp).toLocaleString('zh-CN')})`
        );
      });
    } else {
      logger.warning('暂无对话记录');
    }
  } catch (err: any) {
    logger.error('对话历史测试异常', err.message);
  }

  // ============ 性能测试 ============

  logger.section('测试 4: 性能测试');
  try {
    const timings: number[] = [];
    logger.info('测试获取音量性能 (5 次迭代)');

    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      await MiSpeaker.getVolume();
      const duration = performance.now() - start;
      timings.push(duration);
      process.stdout.write('.');
    }

    console.log('\n');
    const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
    const min = Math.min(...timings);
    const max = Math.max(...timings);

    logger.success('性能测试完成', {
      iterations: 5,
      avg_ms: avg.toFixed(2),
      min_ms: min.toFixed(2),
      max_ms: max.toFixed(2),
    });
  } catch (err: any) {
    logger.error('性能测试异常', err.message);
  }

  logger.title('所有测试完成');
}

main().catch((err) => {
  logger.error('发生错误', err);
  process.exit(1);
});
