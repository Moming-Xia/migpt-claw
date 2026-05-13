/**
 * 简化的调试脚本 - 直接调用核心接口
 * 
 * 使用方式：
 *   npx ts-node debug/test.ts
 * 
 * 这个脚本让你可以直接调用 MiService、MiSpeaker、MiMessage 的接口
 */

import './load-env.js';
import { MiService } from '../src/service.js';
import { MiSpeaker } from '../src/speaker.js';
import { MiMessage } from '../src/message.js';
import { initMiService, loadAndValidateConfig, logger } from './local.js';

async function main() {
  logger.title('直接接口调试脚本');

  // 加载并验证配置
  const result = loadAndValidateConfig();
  if (!result) return;

  const { config, deviceName } = result;

  // ============ 初始化 ============
  if (!(await initMiService(config, deviceName))) {
    return;
  }

  // ============ 消息接口 ============
  const deviceId = MiService.currentDeviceId;

  // 获取历史消息
  const messages = await MiMessage.getHistoryMessages(deviceId, 5);
  logger.success(`获取历史消息: ${messages.length} 条`, 
    messages.map((m) => ({ text: m.text, timestamp: new Date(m.timestamp).toLocaleString('zh-CN') }))
  );

  // 获取最后一条消息
  const lastMsg = await MiMessage.getLastMessage(deviceId);
  if (lastMsg) {
    logger.success('最后一条消息', { text: lastMsg.text, time: new Date(lastMsg.timestamp).toLocaleString('zh-CN') });
  } else {
    logger.warning('暂无消息');
  }

  // 搜索消息
  const searchResults = await MiMessage.searchMessages(deviceId, '关灯', 10);
  logger.success(`搜索"关灯"得到: ${searchResults.length} 条结果`);
}

main().catch((err) => {
  logger.error('发生错误', err);
  process.exit(1);
});
