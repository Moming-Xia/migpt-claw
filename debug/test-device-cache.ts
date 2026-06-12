/**
 * 设备缓存测试脚本
 * 
 * 使用方式：
 *   npx ts-node debug/test-device-cache.ts
 */

import './load-env.js';
import { MiService } from '../src/service.js';
import { deviceCache } from '../src/device-cache.js';
import { loadAndValidateConfig, logger, initMiService } from './local.js';

async function main() {
  logger.title('MiGPT 设备缓存测试');

  // 加载并验证配置
  const result = loadAndValidateConfig();
  if (!result) return;

  const { config, deviceName } = result;

  // ============ Step 1: 初始化 ============

  logger.section('Step 1: 初始化 MiService');
  if (!(await initMiService(config, deviceName))) {
    logger.error('初始化失败，无法继续');
    return;
  }

  // ============ Step 2: 检查缓存 ============

  logger.section('Step 2: 检查设备缓存');

  const cache = await MiService.getDeviceCache();
  if (cache) {
    logger.success('✅ 缓存已加载');
    logger.info('MiNA 设备数量:', cache.minaDevices?.length || 0);
    logger.info('MIoT 设备数量:', cache.miotDevices?.length || 0);
    logger.info('缓存更新时间:', new Date(cache.lastUpdated).toLocaleString('zh-CN'));
  } else {
    logger.warning('⚠️ 缓存为空或未初始化');
  }

  // ============ Step 3: 获取统计信息 ============

  logger.section('Step 3: 缓存统计信息');
  const stats = await MiService.getDeviceCacheStats();
  console.log(`
  MiNA 设备:  ${stats.minaCount} 个
  MIoT 设备:  ${stats.miotCount} 个
  总设备数:   ${stats.totalCount} 个
  缓存年龄:   ${stats.age}
  最后更新:   ${new Date(stats.lastUpdated).toLocaleString('zh-CN')}
  `);

  // ============ Step 4: 查看 MiNA 设备 ============

  logger.section('Step 4: MiNA 设备详情（音箱等）');
  if (cache?.minaDevices && cache.minaDevices.length > 0) {
    cache.minaDevices.forEach((device, index) => {
      console.log(`
  [${index + 1}] ${device.name}
      - 设备 ID:    ${device.deviceID}
      - 型号:       ${device.model}
      - MIoT ID:   ${device.miotDID}
      - MAC 地址:   ${device.mac}
      - 状态:       ${device.presence}
      - 固件版本:   ${device.romVersion}
      `);
    });
  } else {
    logger.warning('暂无 MiNA 设备');
  }

  // ============ Step 5: 查看 MIoT 设备 ============

  logger.section('Step 5: MIoT 设备详情（智能家居设备）');
  if (cache?.miotDevices && cache.miotDevices.length > 0) {
    cache.miotDevices.forEach((device, index) => {
      console.log(`
  [${index + 1}] ${device.name}
      - DID:       ${device.did}
      - 型号:       ${device.model}
      - MAC 地址:   ${device.mac}
      - 在线状态:   ${device.isOnline ? '在线' : '离线'}
      - 本地 IP:   ${device.localip}
      - 描述:       ${device.desc || '(无)'}
      `);
    });
  } else {
    logger.warning('暂无 MIoT 设备');
  }

  // ============ Step 6: 搜索设备 ============

  logger.section('Step 6: 设备搜索测试');

  // 搜索灯相关设备
  const lightSearch = await MiService.searchDevices('light');
  if (lightSearch.miotDevices.length > 0 || lightSearch.minaDevices.length > 0) {
    logger.success(`搜索 "light" 结果:`);
    lightSearch.minaDevices.forEach(d => console.log(`  - [MiNA] ${d.name}`));
    lightSearch.miotDevices.forEach(d => console.log(`  - [MIoT] ${d.name}`));
  } else {
    logger.info('搜索 "light" 无结果');
  }

  // 搜索米家开关
  const switchSearch = await MiService.searchDevices('switch');
  if (switchSearch.miotDevices.length > 0 || switchSearch.minaDevices.length > 0) {
    logger.success(`搜索 "switch" 结果:`);
    switchSearch.minaDevices.forEach(d => console.log(`  - [MiNA] ${d.name}`));
    switchSearch.miotDevices.forEach(d => console.log(`  - [MIoT] ${d.name}`));
  } else {
    logger.info('搜索 "switch" 无结果');
  }

  // ============ Step 7: 测试 AI 可用性 ============

  logger.section('Step 7: AI 工具可用性测试');

  console.log(`
    AI 可通过以下工具访问设备缓存：
    
    1. get_cached_devices
      - 获取所有缓存设备（MiNA + MIoT）
      - 返回完整的设备列表和统计信息
    
    2. get_device_cache_stats
      - 获取缓存统计信息
      - 包括设备数量、缓存年龄等
    
    3. search_devices
      - 按关键词搜索设备
      - 支持设备名称、型号、MAC 地址搜索
    
    缓存文件位置: ~/.openclaw/plugins/migpt-claw/devices.json
    缓存有效期: 24 小时
  `);

  logger.title('测试完成');
}

main()
  .then(() => {
    logger.success('✅ 脚本执行完成');
    process.exit(0);
  })
  .catch(err => {
    logger.error('测试异常', err.message);
    process.exit(1);
  });
