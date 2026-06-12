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
import { sleep } from '../src/utils/parse.js';
import { initMiService, loadAndValidateConfig, logger } from './local.js';

// 氛围灯设备信息（来自 .migpt/devices.json）
const ATMOSPHERE_LIGHT = {
  did: '1165159183',
  name: '氛围灯',
  model: 'giot.plug.v8icm',
  // 智能插座类通用开关属性
  siid: 2,
  piid: 1,
};

async function main() {
  logger.title('氛围灯开关控制测试');

  // 加载并验证配置
  const result = loadAndValidateConfig();
  if (!result) return;

  const { config, deviceName } = result;

  // ============ 初始化 ============
  if (!(await initMiService(config, deviceName))) {
    return;
  }

  if (!MiService.MiOT) {
    logger.error('MIoT 服务未初始化，无法控制设备');
    return;
  }

  const { did, name, siid, piid } = ATMOSPHERE_LIGHT;

  // ============ 读取当前状态 ============
  logger.section(`读取「${name}」当前状态`);
  const current = await MiService.MiOT.getProperty(siid, piid, did);
  if (current === undefined) {
    logger.error('读取属性失败，请确认 siid/piid 是否正确');
    return;
  }
  console.log(`💡 当前开关状态：${current ? '✅ 开启' : '❌ 关闭'}`);

  // ============ 切换开关 ============
  const target = !current;
  logger.section(`切换为「${target ? '开启' : '关闭'}」`);
  const ok = await MiService.MiOT.setProperty(siid, piid, target, did);
  console.log(`🔍 setProperty 原始返回值：${ok}（类型：${typeof ok}）`);
  // ok 为 false 不一定代表失败，部分设备响应格式解析存在差异，以下方回读验证为准
  if (ok) {
    logger.success(`API 返回成功：「${name}」已${target ? '开启' : '关闭'}`);
  } else {
    logger.warning('API 返回非成功，但设备可能已执行（以下方回读验证为准）');
  }

  // ============ 回读验证（延迟 1.5s 等待设备响应） ============
  const VERIFY_DELAY = 500;
  logger.section(`回读验证（等待 ${VERIFY_DELAY}ms 后读取）`);
  console.log(`⏳ 等待设备响应...`);
  await sleep(VERIFY_DELAY);

  const verified = await MiService.MiOT.getProperty(siid, piid, did);
  console.log(`💡 当前开关状态：${verified ? '✅ 开启' : '❌ 关闭'}`);
  if (verified === target) {
    logger.success('状态一致，控制成功');
  } else {
    logger.warning(`状态不一致（期望 ${target}，实际 ${verified}），设备响应可能超过 ${VERIFY_DELAY}ms`);
  }
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
