import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * 获取数据目录
 *
 * - 调试模式（MIGPT_DEBUG=1）：`<cwd>/.migpt/`，方便本地直接查看缓存文件
 * - 生产模式：`~/.openclaw/plugins/migpt-claw/`，与 cwd 无关，重启后稳定
 */
export function getDataDir(subdir?: string): string {
  const baseDir = process.env.MIGPT_DEBUG
    ? join(process.cwd(), '.migpt')
    : join(homedir(), '.openclaw', 'plugins', 'migpt-claw');
  return subdir ? join(baseDir, subdir) : baseDir;
}

/**
 * 读取 JSON 文件
 */
export async function readJSON<T = any>(filename: string): Promise<T | null> {
  try {
    const filepath = join(getDataDir(), filename);
    const content = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * 写入 JSON 文件
 */
export async function writeJSON(filename: string, data: any): Promise<void> {
  try {
    const dir = getDataDir();
    await fs.mkdir(dir, { recursive: true });
    const filepath = join(dir, filename);
    await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err: any) {
    console.error('❌ 写入文件失败:', err.message);
  }
}

/**
 * 检查文件是否存在
 */
export async function fileExists(filepath: string): Promise<boolean> {
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 读取文件
 */
export async function readFile(filepath: string): Promise<Buffer> {
  return fs.readFile(filepath);
}

/**
 * 写入文件
 */
export async function writeFile(filepath: string, content: string | Buffer): Promise<void> {
  const dir = join(filepath, '..');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filepath, content);
}
