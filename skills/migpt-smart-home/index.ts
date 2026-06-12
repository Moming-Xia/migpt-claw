import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { MiService } from '../../src/service.js';
import type { DeviceProtocol } from '../../src/device-cache.js';

/**
 * 小米智能家居设备控制技能
 * 提供对小米 IoT 设备的通用控制能力：获取属性、设置属性、执行动作等
 * 
 * 支持两种协议：
 * - MiNA：小爱音箱标准协议，支持 TTS 播放、音量控制、媒体播放等
 * - MIoT：小米设备通用协议，支持设备属性读写、动作调用、RPC 指令等
 * 
 * 每个设备在缓存中标识了支持的协议，工具调用时会自动依据缓存标识选择对应协议
 */

/**
 * 根据设备 ID 从缓存中查找协议，如果找不到或协议不支持则返回错误信息
 */
async function resolveDeviceProtocol(did: string): Promise<{
  protocol: DeviceProtocol;
  error?: string;
}> {
  const device = await MiService.getDeviceById(did);
  if (!device) {
    return { protocol: 'miot', error: `未在缓存中找到设备 ${did}，将尝试使用 MIoT 协议` };
  }
  return { protocol: device.protocol };
}

/**
 * 确认 MIoT 协议可用，若不可用则返回错误
 */
function ensureMiotAvailable(): { available: boolean; error?: string } {
  if (!MiService.MiOT) {
    return { available: false, error: 'MIoT 服务未初始化，无法执行此操作' };
  }
  return { available: true };
}

export function registerMigptSmartHomeSkill(api: OpenClawPluginApi) {
  // ============ 设备发现 ============

  api.registerTool({
    name: 'find_device',
    description: '搜索设备并返回设备信息（含支持的协议标识）。控制设备前应先调用此工具确认设备及其协议',
    parameters: {
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
          description: '搜索关键词（设备名称、型号、MAC 地址或设备 ID）',
        },
      },
      required: ['keyword'],
    },
    execute: async (input: { keyword: string }) => {
      try {
        const devices = await MiService.findDevices(input.keyword);
        if (devices.length === 0) {
          return {
            success: true,
            data: {
              message: '未找到匹配的设备',
              devices: [],
              total: 0,
            },
          };
        }

        return {
          success: true,
          data: {
            devices: devices.map(d => ({
              id: d.id,
              name: d.name,
              model: d.model,
              protocol: d.protocol,
              online: d.online,
              miotDID: d.miotDID,
            })),
            total: devices.length,
            hint: devices.length === 1
              ? `找到设备「${devices[0].name}」，协议: ${devices[0].protocol}，可使用其 id 调用控制工具`
              : `找到 ${devices.length} 个设备，请根据 id 选择要控制的设备`,
          },
        };
      } catch (err: any) {
        return { success: false, error: err.message || '搜索设备失败' };
      }
    },
  });

  // ============ 设备缓存查询 ============

  api.registerTool({
    name: 'get_cached_devices',
    description: '获取缓存的所有家居设备列表（含协议标识：mina 或 miot）',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      try {
        const devices = await MiService.getAllUnifiedDevices();
        const cache = await MiService.getDeviceCache();

        if (!cache && devices.length === 0) {
          return {
            success: true,
            data: {
              message: '设备缓存为空，请等待初始化完成',
              devices: [],
              minaCount: 0,
              miotCount: 0,
            },
          };
        }

        const minaDevices = devices.filter(d => d.protocol === 'mina');
        const miotDevices = devices.filter(d => d.protocol === 'miot');

        return {
          success: true,
          data: {
            devices: devices.map(d => ({
              id: d.id,
              name: d.name,
              model: d.model,
              protocol: d.protocol,
              online: d.online,
            })),
            minaDevices: minaDevices.map(d => ({
              id: d.id,
              name: d.name,
              model: d.model,
              protocol: d.protocol,
              online: d.online,
              miotDID: d.miotDID,
            })),
            miotDevices: miotDevices.map(d => ({
              id: d.id,
              name: d.name,
              model: d.model,
              protocol: d.protocol,
              online: d.online,
            })),
            minaCount: minaDevices.length,
            miotCount: miotDevices.length,
            total: devices.length,
            lastUpdated: cache ? new Date(cache.lastUpdated).toLocaleString('zh-CN') : null,
          },
        };
      } catch (err: any) {
        return { success: false, error: err.message || '获取设备缓存失败' };
      }
    },
  });

  api.registerTool({
    name: 'get_device_cache_stats',
    description: '获取设备缓存的统计信息',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      try {
        const stats = await MiService.getDeviceCacheStats();
        return {
          success: true,
          data: {
            minaDeviceCount: stats.minaCount,
            miotDeviceCount: stats.miotCount,
            totalDevices: stats.totalCount,
            lastUpdated: new Date(stats.lastUpdated).toLocaleString('zh-CN'),
            cacheAge: stats.age,
          },
        };
      } catch (err: any) {
        return { success: false, error: err.message || '获取缓存统计失败' };
      }
    },
  });

  api.registerTool({
    name: 'search_devices',
    description: '搜索指定名称或型号的设备（按协议分组返回）',
    parameters: {
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
          description: '搜索关键词（设备名称、型号或 MAC 地址）',
        },
      },
      required: ['keyword'],
    },
    execute: async (input: { keyword: string }) => {
      try {
        const result = await MiService.searchDevices(input.keyword);
        return {
          success: true,
          data: {
            keyword: input.keyword,
            minaDevices: result.minaDevices,
            miotDevices: result.miotDevices,
            total:
              (result.minaDevices?.length || 0) + (result.miotDevices?.length || 0),
          },
        };
      } catch (err: any) {
        return { success: false, error: err.message || '搜索设备失败' };
      }
    },
  });

  api.registerTool({
    name: 'refresh_device_cache',
    description: '刷新设备缓存，重新查询所有家居设备（MiNA 和 MIoT）',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      try {
        const result = await MiService.refreshDeviceCache();
        return result;
      } catch (err: any) {
        return {
          success: false,
          message: `❌ 刷新缓存异常：${err.message || '未知错误'}`,
        };
      }
    },
  });

  // ============ 属性操作 ============

  api.registerTool({
    name: 'get_property',
    description: '获取设备的属性值（自动根据设备 ID 选择 MIoT 协议）',
    parameters: {
      type: 'object',
      properties: {
        siid: {
          type: 'number',
          description: 'Service ID（服务 ID，可在设备说明书或米家 App 中查询）',
        },
        piid: {
          type: 'number',
          description: 'Property ID（属性 ID，可在设备说明书或米家 App 中查询）',
        },
        did: {
          type: 'string',
          description: '目标设备 ID（可选，不传则使用默认音箱设备）。建议先用 find_device 查询设备 ID 和协议',
        },
      },
      required: ['siid', 'piid'],
    },
    execute: async (input: { siid: number; piid: number; did?: string }) => {
      try {
        const { available, error } = ensureMiotAvailable();
        if (!available) return { success: false, error };

        // 如果提供了 did，先检查设备协议
        if (input.did) {
          const { protocol, error: protocolError } = await resolveDeviceProtocol(input.did);
          if (protocol === 'mina') {
            return {
              success: false,
              error: `设备 ${input.did} 使用 MiNA 协议，不支持属性读写操作（siid/piid）。MiNA 设备仅支持 TTS 播放、音量控制等功能`,
            };
          }
          if (protocolError) {
            console.warn(`⚠️ ${protocolError}`);
          }
        }

        const value = await MiService.MiOT!.getProperty(input.siid, input.piid, input.did);
        if (value === undefined) {
          return { success: false, error: '获取属性值失败' };
        }

        return {
          success: true,
          data: {
            did: input.did || 'default',
            siid: input.siid,
            piid: input.piid,
            value,
            protocol: 'miot',
          },
        };
      } catch (err: any) {
        return { success: false, error: err.message || '获取属性异常' };
      }
    },
  });

  api.registerTool({
    name: 'set_property',
    description: '设置设备的属性值（自动根据设备 ID 选择 MIoT 协议）',
    parameters: {
      type: 'object',
      properties: {
        siid: {
          type: 'number',
          description: 'Service ID',
        },
        piid: {
          type: 'number',
          description: 'Property ID',
        },
        value: {
          description: '要设置的属性值（数字、字符串或布尔值）',
        },
        did: {
          type: 'string',
          description: '目标设备 ID（可选，不传则使用默认音箱设备）。建议先用 find_device 查询设备 ID 和协议',
        },
      },
      required: ['siid', 'piid', 'value'],
    },
    execute: async (input: { siid: number; piid: number; value: any; did?: string }) => {
      try {
        const { available, error } = ensureMiotAvailable();
        if (!available) return { success: false, error };

        // 如果提供了 did，先检查设备协议
        if (input.did) {
          const { protocol, error: protocolError } = await resolveDeviceProtocol(input.did);
          if (protocol === 'mina') {
            return {
              success: false,
              error: `设备 ${input.did} 使用 MiNA 协议，不支持属性读写操作（siid/piid）。MiNA 设备仅支持 TTS 播放、音量控制等功能`,
            };
          }
          if (protocolError) {
            console.warn(`⚠️ ${protocolError}`);
          }
        }

        const result = await MiService.MiOT!.setProperty(
          input.siid,
          input.piid,
          input.value,
          input.did
        );

        if (result) {
          return {
            success: true,
            message: `属性已设置为 ${input.value}`,
            data: {
              did: input.did || 'default',
              siid: input.siid,
              piid: input.piid,
              value: input.value,
              protocol: 'miot',
            },
          };
        } else {
          return { success: false, error: '设置属性失败' };
        }
      } catch (err: any) {
        return { success: false, error: err.message || '设置属性异常' };
      }
    },
  });

  // ============ 动作执行 ============

  api.registerTool({
    name: 'do_action',
    description: '调用设备的某个动作（自动根据设备 ID 选择 MIoT 协议）',
    parameters: {
      type: 'object',
      properties: {
        siid: {
          type: 'number',
          description: 'Service ID（服务 ID）',
        },
        aiid: {
          type: 'number',
          description: 'Action ID（动作 ID）',
        },
        args: {
          type: 'array',
          description: '动作的参数数组，如果没有参数则传空数组 []',
          default: [],
        },
        did: {
          type: 'string',
          description: '目标设备 ID（可选，不传则使用默认音箱设备）。建议先用 find_device 查询设备 ID 和协议',
        },
      },
      required: ['siid', 'aiid'],
    },
    execute: async (input: { siid: number; aiid: number; args?: any[]; did?: string }) => {
      try {
        const { available, error } = ensureMiotAvailable();
        if (!available) return { success: false, error };

        // 如果提供了 did，先检查设备协议
        if (input.did) {
          const { protocol, error: protocolError } = await resolveDeviceProtocol(input.did);
          if (protocol === 'mina') {
            return {
              success: false,
              error: `设备 ${input.did} 使用 MiNA 协议，不支持动作调用（siid/aiid）。MiNA 设备仅支持 TTS 播放、音量控制等功能`,
            };
          }
          if (protocolError) {
            console.warn(`⚠️ ${protocolError}`);
          }
        }

        const args = input.args || [];
        const result = await MiService.MiOT!.doAction(input.siid, input.aiid, args, input.did);

        if (result) {
          return {
            success: true,
            message: '动作执行成功',
            data: {
              did: input.did || 'default',
              siid: input.siid,
              aiid: input.aiid,
              args,
              protocol: 'miot',
            },
          };
        } else {
          return { success: false, error: '动作执行失败' };
        }
      } catch (err: any) {
        return { success: false, error: err.message || '执行动作异常' };
      }
    },
  });

  // ============ RPC 调用 ============

  api.registerTool({
    name: 'rpc_call',
    description: '直接调用设备的 RPC 指令（高级用法，自动根据设备 ID 选择 MIoT 协议）',
    parameters: {
      type: 'object',
      properties: {
        method: {
          type: 'string',
          description: 'RPC 方法名',
        },
        params: {
          type: 'object',
          description: 'RPC 方法的参数对象',
        },
        did: {
          type: 'string',
          description: '目标设备 ID（可选，不传则使用默认音箱设备）',
        },
      },
      required: ['method'],
    },
    execute: async (input: { method: string; params?: any; id?: number; did?: string }) => {
      try {
        const { available, error } = ensureMiotAvailable();
        if (!available) return { success: false, error };

        // 如果提供了 did，先检查设备协议
        if (input.did) {
          const { protocol, error: protocolError } = await resolveDeviceProtocol(input.did);
          if (protocol === 'mina') {
            return {
              success: false,
              error: `设备 ${input.did} 使用 MiNA 协议，不支持 RPC 调用。MiNA 设备仅支持 TTS 播放、音量控制等功能`,
            };
          }
          if (protocolError) {
            console.warn(`⚠️ ${protocolError}`);
          }
        }

        const result = await MiService.MiOT!.rpc(
          input.method,
          input.params || {},
          input.id || 1,
          input.did
        );

        if (result && result.code === 0) {
          return {
            success: true,
            data: result,
          };
        } else {
          return {
            success: false,
            error: result?.message || 'RPC 调用失败',
            data: result,
          };
        }
      } catch (err: any) {
        return { success: false, error: err.message || 'RPC 调用异常' };
      }
    },
  });

  // ============ 快捷操作 ============

  api.registerTool({
    name: 'smart_toggle',
    description: '切换设备开关状态（常用于灯光、插座等）。需要提供设备 ID 以自动选择协议',
    parameters: {
      type: 'object',
      properties: {
        siid: {
          type: 'number',
          description: 'Service ID',
        },
        piid: {
          type: 'number',
          description: '开关属性 ID（通常是 1）',
        },
        did: {
          type: 'string',
          description: '目标设备 ID。建议先用 find_device 查询设备 ID 和协议',
        },
      },
      required: ['siid', 'piid', 'did'],
    },
    execute: async (input: { siid: number; piid: number; did: string }) => {
      try {
        const { available, error } = ensureMiotAvailable();
        if (!available) return { success: false, error };

        // 检查设备协议
        const { protocol, error: protocolError } = await resolveDeviceProtocol(input.did);
        if (protocol === 'mina') {
          return {
            success: false,
            error: `设备 ${input.did} 使用 MiNA 协议，不支持属性读写操作。MiNA 设备（如音箱）仅支持 TTS 播放、音量控制等功能`,
          };
        }
        if (protocolError) {
          console.warn(`⚠️ ${protocolError}`);
        }

        // 先获取当前状态
        const currentValue = await MiService.MiOT!.getProperty(input.siid, input.piid, input.did);
        if (currentValue === undefined) {
          return { success: false, error: '获取当前状态失败' };
        }

        // 切换状态
        const newValue = !currentValue;
        const result = await MiService.MiOT!.setProperty(
          input.siid,
          input.piid,
          newValue,
          input.did
        );

        if (result) {
          return {
            success: true,
            message: `已${newValue ? '打开' : '关闭'}设备`,
            data: {
              did: input.did,
              previousState: currentValue,
              currentState: newValue,
              protocol: 'miot',
            },
          };
        } else {
          return { success: false, error: '切换状态失败' };
        }
      } catch (err: any) {
        return { success: false, error: err.message || '切换状态异常' };
      }
    },
  });

  api.registerTool({
    name: 'smart_brightness',
    description: '调整灯光或其他设备的亮度（0-100）。需要提供设备 ID 以自动选择协议',
    parameters: {
      type: 'object',
      properties: {
        siid: {
          type: 'number',
          description: 'Service ID',
        },
        piid: {
          type: 'number',
          description: '亮度属性 ID（通常是 2）',
        },
        brightness: {
          type: 'number',
          description: '亮度值（0-100）',
          minimum: 0,
          maximum: 100,
        },
        did: {
          type: 'string',
          description: '目标设备 ID。建议先用 find_device 查询设备 ID 和协议',
        },
      },
      required: ['siid', 'piid', 'brightness', 'did'],
    },
    execute: async (input: { siid: number; piid: number; brightness: number; did: string }) => {
      try {
        const { available, error } = ensureMiotAvailable();
        if (!available) return { success: false, error };

        // 检查设备协议
        const { protocol, error: protocolError } = await resolveDeviceProtocol(input.did);
        if (protocol === 'mina') {
          return {
            success: false,
            error: `设备 ${input.did} 使用 MiNA 协议，不支持属性读写操作。MiNA 设备（如音箱）仅支持 TTS 播放、音量控制等功能`,
          };
        }
        if (protocolError) {
          console.warn(`⚠️ ${protocolError}`);
        }

        const brightness = Math.max(0, Math.min(100, input.brightness));
        const result = await MiService.MiOT!.setProperty(
          input.siid,
          input.piid,
          brightness,
          input.did
        );

        if (result) {
          return {
            success: true,
            message: `亮度已调至 ${brightness}%`,
            data: {
              did: input.did,
              siid: input.siid,
              piid: input.piid,
              brightness,
              protocol: 'miot',
            },
          };
        } else {
          return { success: false, error: '调整亮度失败' };
        }
      } catch (err: any) {
        return { success: false, error: err.message || '调整亮度异常' };
      }
    },
  });

  api.registerTool({
    name: 'smart_color_temperature',
    description: '调整灯光的色温（需要设备支持）。需要提供设备 ID 以自动选择协议',
    parameters: {
      type: 'object',
      properties: {
        siid: {
          type: 'number',
          description: 'Service ID',
        },
        piid: {
          type: 'number',
          description: '色温属性 ID',
        },
        temperature: {
          type: 'number',
          description: '色温值（通常 1700-6500K，具体范围见设备说明书）',
        },
        did: {
          type: 'string',
          description: '目标设备 ID。建议先用 find_device 查询设备 ID 和协议',
        },
      },
      required: ['siid', 'piid', 'temperature', 'did'],
    },
    execute: async (input: {
      siid: number;
      piid: number;
      temperature: number;
      did: string;
    }) => {
      try {
        const { available, error } = ensureMiotAvailable();
        if (!available) return { success: false, error };

        // 检查设备协议
        const { protocol, error: protocolError } = await resolveDeviceProtocol(input.did);
        if (protocol === 'mina') {
          return {
            success: false,
            error: `设备 ${input.did} 使用 MiNA 协议，不支持属性读写操作。MiNA 设备（如音箱）仅支持 TTS 播放、音量控制等功能`,
          };
        }
        if (protocolError) {
          console.warn(`⚠️ ${protocolError}`);
        }

        const result = await MiService.MiOT!.setProperty(
          input.siid,
          input.piid,
          input.temperature,
          input.did
        );

        if (result) {
          return {
            success: true,
            message: `色温已调至 ${input.temperature}K`,
            data: {
              did: input.did,
              siid: input.siid,
              piid: input.piid,
              temperature: input.temperature,
              protocol: 'miot',
            },
          };
        } else {
          return { success: false, error: '调整色温失败' };
        }
      } catch (err: any) {
        return { success: false, error: err.message || '调整色温异常' };
      }
    },
  });
}
