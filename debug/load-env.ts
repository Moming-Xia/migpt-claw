/**
 * 环境变量加载工具
 * 从 envConfig/.env.local 读取环境变量
 * 
 * 使用方式：
 *   import './load-env.js'; // 在脚本最顶部
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, '');

/**
 * 从文件加载环境变量
 */
export function loadEnvFile(filePath: string): void {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (const line of lines) {
      // 跳过注释和空行
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // 解析 KEY=VALUE
      const match = trimmed.match(/^\s*([^=]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1].trim();
        let value = (match[2] || '').trim();

        // 移除引号
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        // 只设置不存在的环境变量（避免覆盖已设置的）
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  } catch (err: any) {
    // 如果文件不存在，静默忽略
    if (err?.code !== 'ENOENT') {
      console.warn(`⚠️ 加载环境变量文件失败: ${filePath}`, err?.message);
    }
  }
}

// 自动加载 envConfig/.env.local
try {
  const envLocalPath = resolve(__dirname, '../envConfig/.env.local');
  loadEnvFile(envLocalPath);
} catch (err: any) {
  console.error('❌ 环境变量加载出错:', err?.message);
}
