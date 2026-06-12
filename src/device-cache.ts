/**
 * 家居设备缓存管理器
 * 
 * 用于缓存和管理所有小米智能家居设备信息，包括：
 * - MiNA 设备（主要是音箱）
 * - MIoT 设备（智能家居设备）
 * 
 * 缓存文件位置：~/.openclaw/plugins/migpt-claw/devices.json
 */

import { readJSON, writeJSON } from './utils/io.js';
import { Debugger } from './utils/debug.js';

/** 设备支持的协议类型 */
export type DeviceProtocol = 'mina' | 'miot';

/** 统一设备信息（包含协议标识） */
export interface UnifiedDevice {
  /** 设备 ID（MiNA 设备为 deviceID，MIoT 设备为 did） */
  id: string;
  /** 设备名称 */
  name: string;
  /** 设备型号 */
  model?: string;
  /** 设备 MAC 地址 */
  mac?: string;
  /** 设备支持的协议 */
  protocol: DeviceProtocol;
  /** 是否在线 */
  online?: boolean;
  /** MiNA 设备的 miotDID（若同时支持 MIoT 协议） */
  miotDID?: string;
  /** 原始设备数据 */
  raw: Record<string, any>;
}

export interface DeviceCacheData {
  /** 缓存最后更新时间 */
  lastUpdated: number;
  
  /** MiNA 设备列表（主要是音箱） */
  minaDevices: Array<{
    deviceID: string;
    serialNumber?: string;
    name: string;
    alias?: string;
    model?: string;
    miotDID?: string;
    mac?: string;
    presence?: 'online' | 'offline';
    address?: string;
    hardware?: string;
    romVersion?: string;
    /** 设备支持的协议 */
    protocol: DeviceProtocol;
  }>;

  /** MIoT 设备列表（智能家居设备） */
  miotDevices: Array<{
    did: string;
    name: string;
    model: string;
    mac?: string;
    pid?: string;
    localip?: string;
    isOnline?: boolean;
    desc?: string;
    extra?: Record<string, any>;
    /** 设备支持的协议 */
    protocol: DeviceProtocol;
    [key: string]: any;
  }>;

  /** 设备别名映射 */
  deviceAliases: Record<string, string>;
}

const CACHE_FILE = 'devices.json';

/** 缓存有效期：24 小时 */
export const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 小时

class DeviceCache {
  private _cache: DeviceCacheData | null = null;
  private _loaded = false;

  /**
   * 初始化缓存
   */
  async init(): Promise<void> {
    if (this._loaded) return;
    
    try {
      this._cache = await readJSON<DeviceCacheData>(CACHE_FILE);
      this._loaded = true;
      
      if (this._cache) {
        const age = Date.now() - this._cache.lastUpdated;
        if (age > CACHE_DURATION) {
          if (Debugger.debug) {
            console.log(`🐛 设备缓存已过期 (${Math.round(age / 1000 / 60)} 分钟)`);
          }
          this._cache = null;
        } else if (Debugger.debug) {
          console.log(`🐛 设备缓存已加载 (${Math.round(age / 1000)} 秒前)`);
        }
      }
    } catch (err: any) {
      if (Debugger.debug) {
        console.log('🐛 设备缓存加载失败:', err.message);
      }
      this._cache = null;
    }
  }

  /**
   * 获取所有缓存的设备
   */
  async getAllDevices(): Promise<DeviceCacheData | null> {
    await this.init();
    return this._cache;
  }

  /**
   * 获取 MiNA 设备列表
   */
  async getMinaDevices(): Promise<DeviceCacheData['minaDevices']> {
    await this.init();
    return this._cache?.minaDevices || [];
  }

  /**
   * 获取 MIoT 设备列表
   */
  async getMiotDevices(): Promise<DeviceCacheData['miotDevices']> {
    await this.init();
    return this._cache?.miotDevices || [];
  }

  /**
   * 搜索设备
   */
  async searchDevice(keyword: string): Promise<{
    minaDevices: DeviceCacheData['minaDevices'];
    miotDevices: DeviceCacheData['miotDevices'];
  }> {
    await this.init();
    const lowerKeyword = keyword.toLowerCase();
    
    return {
      minaDevices: (this._cache?.minaDevices || []).filter(d =>
        d.name?.toLowerCase().includes(lowerKeyword) ||
        d.alias?.toLowerCase().includes(lowerKeyword) ||
        d.model?.toLowerCase().includes(lowerKeyword) ||
        d.mac?.includes(keyword)
      ),
      miotDevices: (this._cache?.miotDevices || []).filter(d =>
        d.name?.toLowerCase().includes(lowerKeyword) ||
        d.model?.toLowerCase().includes(lowerKeyword) ||
        d.mac?.includes(keyword) ||
        d.did?.includes(keyword)
      ),
    };
  }

  /**
   * 统一搜索设备（返回带协议标识的设备列表）
   */
  async searchUnifiedDevices(keyword: string): Promise<UnifiedDevice[]> {
    await this.init();
    const lowerKeyword = keyword.toLowerCase();
    const results: UnifiedDevice[] = [];

    // 搜索 MiNA 设备
    for (const d of this._cache?.minaDevices || []) {
      if (
        d.name?.toLowerCase().includes(lowerKeyword) ||
        d.alias?.toLowerCase().includes(lowerKeyword) ||
        d.model?.toLowerCase().includes(lowerKeyword) ||
        d.mac?.includes(keyword)
      ) {
        results.push({
          id: d.deviceID,
          name: d.name,
          model: d.model,
          mac: d.mac,
          protocol: 'mina',
          online: d.presence === 'online',
          miotDID: d.miotDID,
          raw: d as any,
        });
      }
    }

    // 搜索 MIoT 设备
    for (const d of this._cache?.miotDevices || []) {
      if (
        d.name?.toLowerCase().includes(lowerKeyword) ||
        d.model?.toLowerCase().includes(lowerKeyword) ||
        d.mac?.includes(keyword) ||
        d.did?.includes(keyword)
      ) {
        results.push({
          id: d.did,
          name: d.name,
          model: d.model,
          mac: d.mac,
          protocol: 'miot',
          online: d.isOnline,
          raw: d as any,
        });
      }
    }

    return results;
  }

  /**
   * 根据 ID 获取设备信息（包含协议标识）
   */
  async getDeviceById(id: string): Promise<UnifiedDevice | null> {
    await this.init();

    // 先在 MiNA 设备中查找
    const minaDevice = (this._cache?.minaDevices || []).find(
      d => d.deviceID === id || d.miotDID === id || d.mac === id
    );
    if (minaDevice) {
      return {
        id: minaDevice.deviceID,
        name: minaDevice.name,
        model: minaDevice.model,
        mac: minaDevice.mac,
        protocol: 'mina',
        online: minaDevice.presence === 'online',
        miotDID: minaDevice.miotDID,
        raw: minaDevice as any,
      };
    }

    // 再在 MIoT 设备中查找
    const miotDevice = (this._cache?.miotDevices || []).find(
      d => d.did === id || d.mac === id
    );
    if (miotDevice) {
      return {
        id: miotDevice.did,
        name: miotDevice.name,
        model: miotDevice.model,
        mac: miotDevice.mac,
        protocol: 'miot',
        online: miotDevice.isOnline,
        raw: miotDevice as any,
      };
    }

    return null;
  }

  /**
   * 获取所有设备的统一列表（包含协议标识）
   */
  async getAllUnifiedDevices(): Promise<UnifiedDevice[]> {
    await this.init();
    const devices: UnifiedDevice[] = [];

    for (const d of this._cache?.minaDevices || []) {
      devices.push({
        id: d.deviceID,
        name: d.name,
        model: d.model,
        mac: d.mac,
        protocol: 'mina',
        online: d.presence === 'online',
        miotDID: d.miotDID,
        raw: d as any,
      });
    }

    for (const d of this._cache?.miotDevices || []) {
      devices.push({
        id: d.did,
        name: d.name,
        model: d.model,
        mac: d.mac,
        protocol: 'miot',
        online: d.isOnline,
        raw: d as any,
      });
    }

    return devices;
  }

  /**
   * 根据设备 ID 获取其支持的协议
   */
  async getDeviceProtocol(id: string): Promise<DeviceProtocol | null> {
    const device = await this.getDeviceById(id);
    return device?.protocol ?? null;
  }

  /**
   * 获取设备统计信息
   */
  async getStats(): Promise<{
    minaCount: number;
    miotCount: number;
    totalCount: number;
    lastUpdated: number;
    age: string;
  }> {
    await this.init();
    
    const minaCount = this._cache?.minaDevices.length || 0;
    const miotCount = this._cache?.miotDevices.length || 0;
    const lastUpdated = this._cache?.lastUpdated || 0;
    const age = this._formatAge(lastUpdated);
    
    return {
      minaCount,
      miotCount,
      totalCount: minaCount + miotCount,
      lastUpdated,
      age,
    };
  }

  /**
   * 更新缓存
   */
  async updateCache(
    minaDevices: DeviceCacheData['minaDevices'],
    miotDevices: DeviceCacheData['miotDevices'],
  ): Promise<void> {
    const cache: DeviceCacheData = {
      lastUpdated: Date.now(),
      minaDevices,
      miotDevices,
      deviceAliases: this._buildAliasMap(minaDevices, miotDevices),
    };

    this._cache = cache;
    
    try {
      await writeJSON(CACHE_FILE, cache);
      console.log(
        `✅ 设备缓存已更新: ${minaDevices.length} 个 MiNA 设备, ${miotDevices.length} 个 MIoT 设备`
      );
    } catch (err: any) {
      console.error('❌ 设备缓存更新失败:', err.message);
    }
  }

  /**
   * 清空缓存
   */
  async clearCache(): Promise<void> {
    this._cache = null;
    this._loaded = false;
    
    try {
      // 删除缓存文件
      const fs = await import('node:fs/promises');
      const { getDataDir } = await import('./utils/io.js');
      const filepath = `${getDataDir()}/${CACHE_FILE}`;
      await fs.unlink(filepath);
      console.log('✅ 设备缓存已清空');
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        console.error('❌ 清空缓存失败:', err.message);
      }
    }
  }

  /**
   * 构建设备别名映射
   */
  private _buildAliasMap(
    minaDevices: DeviceCacheData['minaDevices'],
    miotDevices: DeviceCacheData['miotDevices'],
  ): Record<string, string> {
    const aliases: Record<string, string> = {};

    minaDevices.forEach(device => {
      aliases[device.deviceID] = device.name;
      if (device.alias) aliases[device.alias] = device.name;
      if (device.miotDID) aliases[device.miotDID] = device.name;
      if (device.mac) aliases[device.mac] = device.name;
    });

    miotDevices.forEach(device => {
      aliases[device.did] = device.name;
      if (device.mac) aliases[device.mac] = device.name;
    });

    return aliases;
  }

  /**
   * 格式化时间差
   */
  private _formatAge(timestamp: number): string {
    const age = Date.now() - timestamp;
    const seconds = Math.round(age / 1000);
    const minutes = Math.round(age / 60000);
    const hours = Math.round(age / 3600000);
    const days = Math.round(age / 86400000);

    if (seconds < 60) return `${seconds} 秒前`;
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    return `${days} 天前`;
  }
}

export const deviceCache = new DeviceCache();
