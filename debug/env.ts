/**
 * 环境变量配置工具
 * 用于本地调试时从环境变量读取敏感配置
 */

import type { MiServiceConfig } from '../src/service.js';

/**
 * 从环境变量读取小米账号配置
 * 
 * 环境变量说明：
 * - MI_USER_ID: 小米账号 ID
 * - MI_PASSWORD: 小米账号密码
 * - MI_PASS_TOKEN: 小米登录凭证（可选，优先于密码）
 * - MI_DEVICE_NAME: 设备名称（如"客厅音箱"）
 * - MI_DEBUG: 是否启用调试模式 (true/false)
 * - MI_TIMEOUT: 网络请求超时时长（毫秒）
 * - MI_SPEAKER_CONTROL: 音箱控制方式 (mina/miot)
 */
export function loadConfigFromEnv(): {
  config: MiServiceConfig;
  deviceName: string;
  isConfigured: boolean;
} {
  const config: MiServiceConfig = {
    userId: process.env.MI_USER_ID,
    password: process.env.MI_PASSWORD,
    passToken: process.env.MI_PASS_TOKEN,
    debug: process.env.MI_DEBUG === 'true',
    timeout: process.env.MI_TIMEOUT ? parseInt(process.env.MI_TIMEOUT) : 5000,
    speakerControl: (process.env.MI_SPEAKER_CONTROL as 'mina' | 'miot') || 'mina',
  };

  const deviceName = process.env.MI_DEVICE_NAME || '客厅音箱';

  // 验证配置是否完整
  const isConfigured =
    !!(config.passToken || (config.userId && config.password)) &&
    !!deviceName;

  return {
    config,
    deviceName,
    isConfigured,
  };
}

/**
 * 打印环境配置（不显示敏感信息）
 */
export function printConfigInfo(config: MiServiceConfig, deviceName: string) {
  console.log('\n📋 小米账号配置信息');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📱 设备名称: ${deviceName}`);
  console.log(`👤 用户 ID: ${config.userId ? '✓ 已设置' : '✗ 未设置'}`);
  console.log(`🔐 密码: ${config.password ? '✓ 已设置' : '✗ 未设置'}`);
  console.log(`🎫 Pass Token: ${config.passToken ? '✓ 已设置' : '✗ 未设置'}`);
  console.log(`🐛 调试模式: ${config.debug ? '✓ 启用' : '✗ 禁用'}`);
  console.log(`⏱️  超时时长: ${config.timeout}ms`);
  console.log(`🔊 控制方式: ${config.speakerControl}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

/**
 * 验证配置完整性
 */
export function validateConfig(config: MiServiceConfig, deviceName: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.passToken && !config.userId) {
    errors.push('❌ 必须提供 MI_PASS_TOKEN 或 MI_USER_ID 环境变量');
  }

  if (!config.passToken && !config.password) {
    errors.push('❌ 必须提供 MI_PASS_TOKEN 或 MI_PASSWORD 环境变量');
  }

  if (!deviceName) {
    errors.push('❌ 必须提供 MI_DEVICE_NAME 环境变量');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 生成 .env.local 文件模板
 */
export function generateEnvTemplate(): string {
  return `# 小米账号配置（用于本地调试）
# 复制此文件为 .env.local，然后填入实际的值

# 小米账号 ID（数字账号）
MI_USER_ID=your_mi_user_id

# 小米账号密码
MI_PASSWORD=your_mi_password

# 或使用登录凭证（优先于密码）
MI_PASS_TOKEN=your_pass_token

# 设备名称（如"客厅音箱"）
MI_DEVICE_NAME=客厅音箱

# 是否启用调试模式
MI_DEBUG=true

# 网络请求超时时长（毫秒）
MI_TIMEOUT=5000

# 音箱控制方式 (mina/miot)
MI_SPEAKER_CONTROL=mina
`;
}
