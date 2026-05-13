/**
 * 智能家居设备 (MIoT) 功能测试脚本
 * 
 * 使用方式：
 *   npx ts-node debug/test-smart-home.ts
 */

import './load-env.js';
import { MiService } from '../src/service.js';
import { initMiService, loadAndValidateConfig, logger } from './local.js';

async function main() {
  logger.title('小米智能家居设备测试');

  // 加载并验证配置
  const result = loadAndValidateConfig();
  if (!result) return;

  const { config, deviceName } = result;

  // 初始化
  if (!(await initMiService(config, deviceName))) {
    return;
  }

  // ============ 设备管理 ============

  logger.section('测试 1: 获取设备列表');
  try {
    const devices = await MiService.getDevices(config);
    if (devices.length > 0) {
      logger.success(`获取到 ${devices.length} 个设备`);
      devices.forEach((device, index) => {
        console.log(`  [${index + 1}] ${device.name} (${device.model}) - ${device.did}`);
      });
    } else {
      logger.warning('未找到任何设备');
    }
  } catch (err: any) {
    logger.error('获取设备列表失败', err.message);
  }

  // ============ MIoT 设备 ============

  logger.section('测试 2: 获取 MIoT 设备');
  try {
    if (!MiService.MiOT) {
      logger.warning('MIoT 服务未初始化，可能该账号没有 MIoT 设备');
    } else {
      const devices = await MiService.MiOT.getDevices();
      if (devices && devices.length > 0) {
        logger.success(`获取到 ${devices.length} 个 MIoT 设备`);
        devices.forEach((device: any, index: number) => {
          console.log(`  [${index + 1}] ${device.name} (${device.model}) - Status: ${device.status}`);
        });
      } else {
        logger.warning('未找到任何 MIoT 设备');
      }
    }
  } catch (err: any) {
    logger.error('获取 MIoT 设备失败', err.message);
  }

  // ============ 属性查询示例 ============

  logger.section('测试 3: MIoT 属性查询示例');
  logger.info('常见的 siid/piid 组合:');
  console.log(`
  灯光设备:
    - 灯光服务 (siid=2):
      - 开关状态 (piid=1)
      - 亮度 (piid=2)
      - 色温 (piid=3)
  
  插座设备:
    - 开关服务 (siid=2):
      - 开关状态 (piid=1)
    - 电源服务 (siid=3):
      - 功率 (piid=1)
      - 电流 (piid=2)
      - 电压 (piid=3)
  
  如要测试，请修改下方代码中的 siid 和 piid 值
  `);

  // 如果要测试某个属性，取消注释并修改参数
  // try {
  //   if (MiService.MiOT) {
  //     const value = await MiService.MiOT.getProperty(2, 1);  // 灯光开关
  //     logger.success('属性查询成功', { value });
  //   }
  // } catch (err: any) {
  //   logger.error('属性查询失败', err.message);
  // }

  // ============ 性能测试 ============

  logger.section('测试 4: 性能测试');
  try {
    if (!MiService.MiOT) {
      logger.warning('MIoT 服务未初始化，跳过性能测试');
    } else {
      const timings: number[] = [];
      logger.info('测试获取 MIoT 设备列表性能 (3 次迭代)');

      for (let i = 0; i < 3; i++) {
        const start = performance.now();
        await MiService.MiOT.getDevices();
        const duration = performance.now() - start;
        timings.push(duration);
        process.stdout.write('.');
      }

      console.log('\n');
      const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
      const min = Math.min(...timings);
      const max = Math.max(...timings);

      logger.success('性能测试完成', {
        iterations: 3,
        avg_ms: avg.toFixed(2),
        min_ms: min.toFixed(2),
        max_ms: max.toFixed(2),
      });
    }
  } catch (err: any) {
    logger.error('性能测试失败', err.message);
  }

  logger.title('所有测试完成');
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
