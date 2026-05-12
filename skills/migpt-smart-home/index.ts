import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { MiService } from '../../src/service.js';
import type { MIoTDevice } from '../../src/mi/typing.js';

/**
 * 小米智能家居设备控制技能
 * 提供对小米 IoT 设备的通用控制能力：获取属性、设置属性、执行动作等
 */
export function registerMigptSmartHomeSkill(api: OpenClawPluginApi) {
  // ============ 设备管理 ============

  api.registerTool({
    name: 'get_device_list',
    description: '获取账户下的所有小米设备列表',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      try {
        if (!MiService.MiOT) {
          return { success: false, error: 'MIoT 服务未初始化' };
        }

        const devices = await MiService.MiOT.getDevices();
        if (!devices || devices.length === 0) {
          return { success: true, data: { devices: [], total: 0 } };
        }

        // 格式化设备信息
        const formattedDevices = devices.map((device: any) => ({
          deviceId: device.did || device.deviceID,
          name: device.name,
          model: device.model,
          type: device.type,
          status: device.status,
          online: device.status === 'online',
          category: device.type?.split('.')[0], // 提取设备大类（如 light, switch）
        }));

        return {
          success: true,
          data: {
            devices: formattedDevices,
            total: formattedDevices.length,
          },
        };
      } catch (err: any) {
        return { success: false, error: err.message || '获取设备列表失败' };
      }
    },
  });

  // ============ 属性操作 ============

  api.registerTool({
    name: 'get_property',
    description: '获取 MIoT 设备的属性值',
    inputSchema: {
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
      },
      required: ['siid', 'piid'],
    },
    execute: async (input: { siid: number; piid: number }) => {
      try {
        if (!MiService.MiOT) {
          return { success: false, error: 'MIoT 服务未初始化' };
        }

        const value = await MiService.MiOT.getProperty(input.siid, input.piid);
        if (value === undefined) {
          return { success: false, error: '获取属性值失败' };
        }

        return {
          success: true,
          data: {
            siid: input.siid,
            piid: input.piid,
            value,
          },
        };
      } catch (err: any) {
        return { success: false, error: err.message || '获取属性异常' };
      }
    },
  });

  api.registerTool({
    name: 'set_property',
    description: '设置 MIoT 设备的属性值',
    inputSchema: {
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
      },
      required: ['siid', 'piid', 'value'],
    },
    execute: async (input: { siid: number; piid: number; value: any }) => {
      try {
        if (!MiService.MiOT) {
          return { success: false, error: 'MIoT 服务未初始化' };
        }

        const result = await MiService.MiOT.setProperty(
          input.siid,
          input.piid,
          input.value
        );

        if (result) {
          return {
            success: true,
            message: `属性已设置为 ${input.value}`,
            data: {
              siid: input.siid,
              piid: input.piid,
              value: input.value,
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
    description: '调用 MIoT 设备的某个动作',
    inputSchema: {
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
      },
      required: ['siid', 'aiid'],
    },
    execute: async (input: { siid: number; aiid: number; args?: any[] }) => {
      try {
        if (!MiService.MiOT) {
          return { success: false, error: 'MIoT 服务未初始化' };
        }

        const args = input.args || [];
        const result = await MiService.MiOT.doAction(input.siid, input.aiid, args);

        if (result) {
          return {
            success: true,
            message: '动作执行成功',
            data: {
              siid: input.siid,
              aiid: input.aiid,
              args,
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
    description: '直接调用 MIoT 设备的 RPC 指令（高级用法）',
    inputSchema: {
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
      },
      required: ['method'],
    },
    execute: async (input: { method: string; params?: any; id?: number }) => {
      try {
        if (!MiService.MiOT) {
          return { success: false, error: 'MIoT 服务未初始化' };
        }

        const result = await MiService.MiOT.rpc(
          input.method,
          input.params || {},
          input.id || 1
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
    description: '切换设备开关状态（常用于灯光、插座等）',
    inputSchema: {
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
      },
      required: ['siid', 'piid'],
    },
    execute: async (input: { siid: number; piid: number }) => {
      try {
        if (!MiService.MiOT) {
          return { success: false, error: 'MIoT 服务未初始化' };
        }

        // 先获取当前状态
        const currentValue = await MiService.MiOT.getProperty(input.siid, input.piid);
        if (currentValue === undefined) {
          return { success: false, error: '获取当前状态失败' };
        }

        // 切换状态
        const newValue = !currentValue;
        const result = await MiService.MiOT.setProperty(
          input.siid,
          input.piid,
          newValue
        );

        if (result) {
          return {
            success: true,
            message: `已${newValue ? '打开' : '关闭'}设备`,
            data: {
              previousState: currentValue,
              currentState: newValue,
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
    description: '调整灯光或其他设备的亮度（0-100）',
    inputSchema: {
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
      },
      required: ['siid', 'piid', 'brightness'],
    },
    execute: async (input: { siid: number; piid: number; brightness: number }) => {
      try {
        if (!MiService.MiOT) {
          return { success: false, error: 'MIoT 服务未初始化' };
        }

        const brightness = Math.max(0, Math.min(100, input.brightness));
        const result = await MiService.MiOT.setProperty(
          input.siid,
          input.piid,
          brightness
        );

        if (result) {
          return {
            success: true,
            message: `亮度已调至 ${brightness}%`,
            data: {
              siid: input.siid,
              piid: input.piid,
              brightness,
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
    description: '调整灯光的色温（需要设备支持）',
    inputSchema: {
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
      },
      required: ['siid', 'piid', 'temperature'],
    },
    execute: async (input: {
      siid: number;
      piid: number;
      temperature: number;
    }) => {
      try {
        if (!MiService.MiOT) {
          return { success: false, error: 'MIoT 服务未初始化' };
        }

        const result = await MiService.MiOT.setProperty(
          input.siid,
          input.piid,
          input.temperature
        );

        if (result) {
          return {
            success: true,
            message: `色温已调至 ${input.temperature}K`,
            data: {
              siid: input.siid,
              piid: input.piid,
              temperature: input.temperature,
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
