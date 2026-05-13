import { jsonEncode } from '../utils/parse.js';
import { decodeMIoT, encodeFormData, encodeMIoT } from '../utils/codec.js';
import { Http } from '../utils/http.js';
import { updateMiAccount } from './common.js';
import { Debugger } from '../utils/debug.js';
import type { MIoTDevice, MiAccount } from './typing.js';

type MIoTAccount = MiAccount & { device: MIoTDevice };

export class MIoT {
  account: MIoTAccount;

  constructor(account: MIoTAccount) {
    this.account = account;
  }

  static async getDevice(account: MIoTAccount): Promise<MIoTAccount> {
    if (account.sid !== 'xiaomiio') {
      return account;
    }
    const devices = await MIoT.__callMIoT(account, 'POST', '/home/device_list', {
      getVirtualModel: false,
      getHuamiDevices: 0,
    });
    if (Debugger.debug) {
      console.log('🐛 MIoT 设备列表：', jsonEncode(devices, { prettier: true }));
    }
    const device = (devices?.list ?? []).find((e: any) =>
      [e.did, e.name, e.mac].includes(account.did),
    );
    if (device) {
      account.device = device;
    }
    return account;
  }

  private static async __callMIoT(
    account: MIoTAccount,
    method: 'GET' | 'POST',
    path: string,
    _data?: any,
  ) {
    const url = `https://api.io.mi.com/app${path}`;
    const config = {
      account,
      setAccount: updateMiAccount(account),
      rawResponse: true,
      validateStatus: () => true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
        'x-xiaomi-protocal-flag-cli': 'PROTOCAL-HTTP2',
      },
      cookies: {
        userId: account.userId,
        serviceToken: account.serviceToken,
        PassportDeviceId: account.deviceId,
      },
    };

    const data = encodeMIoT(path, _data, account.pass!.ssecurity!);
    if (Debugger.debug) {
      console.log('MIoT 请求:', {
        url,
        method,
        cookies: config.cookies,
        body: data,
      });
    }

    let res: any;
    if (method === 'GET') {
      res = await Http.get(url, data, config);
    } else {
      // POST body 使用 application/x-www-form-urlencoded 格式
      const formData = encodeFormData(data);
      if (Debugger.debug) {
        console.log('POST body:', formData);
      }
      res = await Http.post(url, formData, {
        ...config,
        headers: {
          ...config.headers,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
    }
    
    // 检查错误
    if (res.status === 401) {
      console.error('❌ 401 错误响应:', res.data);
      return undefined;
    }
    
    // MiService 返回的是明文 JSON，直接解析
    if (res.data && typeof res.data === 'object' && res.data.code === 0) {
      return res.data.result;
    }
    
    // 如果是加密字符串，尝试解密
    if (typeof res.data === 'string') {
      try {
        res = await decodeMIoT(
          account.pass!.ssecurity!,
          data._nonce,
          res.data,
          res.headers['miot-content-encoding'] === 'GZIP',
        );
        return res?.result;
      } catch (e) {
        console.error('❌ 解密失败:', e);
        return undefined;
      }
    }
    
    console.error('❌ 未知响应格式:', res);
    return undefined;
  }

  private async _callMIoT(method: 'GET' | 'POST', path: string, data?: any) {
    return MIoT.__callMIoT(this.account, method, path, data);
  }

  /**
   * 获取 MIoT 设备列表
   */
  async getDevices(getVirtualModel = false, getHuamiDevices = 0) {
    const res = await this._callMIoT('POST', '/home/device_list', {
      getVirtualModel: getVirtualModel,
      getHuamiDevices: getHuamiDevices,
    });
    return res?.list;
  }

  /**
   * 获取 MIoT 设备属性值
   * @param scope Service ID (siid)
   * @param property Property ID (piid)
   * @param did 目标设备 ID（可选，默认为当前音箱设备）
   */
  async getProperty(scope: number, property: number, did?: string) {
    const targetDid = did || this.account.device.did;
    const res = await this._callMIoTSpec('prop/get', [
      {
        did: targetDid,
        siid: scope,
        piid: property,
      },
    ]);
    return (res ?? [])?.[0]?.value;
  }

  /**
   * 设置 MIoT 设备属性值
   * @param scope Service ID (siid)
   * @param property Property ID (piid)
   * @param value 要设置的值
   * @param did 目标设备 ID（可选，默认为当前音箱设备）
   */
  async setProperty(scope: number, property: number, value: any, did?: string) {
    const targetDid = did || this.account.device.did;
    const res = await this._callMIoTSpec('prop/set', [
      {
        did: targetDid,
        siid: scope,
        piid: property,
        value: value,
      },
    ]);
    if (Debugger.debug) {
      console.log('🐛 prop/set raw response:', JSON.stringify(res));
    }
    // 外层调用失败（网络/认证错误）
    if (res === undefined) return false;
    // 标准 MIoT spec 格式：[{ did, siid, piid, code }]
    // MIoT 错误码均为负数（如 -704002008），0 和正数均表示成功
    // 本地协议设备可能返回 code: 1 表示成功（而非 code: 0）
    if (Array.isArray(res)) {
      if (res.length === 0) return true;
      const code = res[0]?.code;
      return code === undefined || (typeof code === 'number' && code >= 0);
    }
    // 其他有效响应（如 { code: 0 }）一律视为成功
    return true;
  }

  /**
   * 调用 MIoT 设备能力指令
   * @param scope Service ID (siid)
   * @param action Action ID (aiid)
   * @param args 动作参数
   * @param did 目标设备 ID（可选，默认为当前音箱设备）
   */
  async doAction(scope: number, action: number, args: any = [], did?: string) {
    const targetDid = did || this.account.device.did;
    const res = await this._callMIoTSpec('action', {
      did: targetDid,
      siid: scope,
      aiid: action,
      in: Array.isArray(args) ? args : [args],
    });
    if (Debugger.debug) {
      console.log('🐛 action raw response:', JSON.stringify(res));
    }
    if (res === undefined) return false;
    // action 响应格式：{ code, out: [...] }，错误码均为负数
    if (typeof res === 'object' && !Array.isArray(res)) {
      const code = res?.code;
      return code === undefined || (typeof code === 'number' && code >= 0);
    }
    return true;
  }

  /**
   * 调用 MIoT 设备 RPC 指令
   * @param method RPC 方法名
   * @param params 参数
   * @param id 请求 ID
   * @param did 目标设备 ID（可选，默认为当前音箱设备）
   */
  rpc(method: string, params: any, id = 1, did?: string) {
    const targetDid = did || this.account.device.did;
    return this._callMIoT('POST', `/home/rpc/${targetDid}`, {
      id,
      method,
      params,
    });
  }

  private _callMIoTSpec(command: string, params: any, datasource = 2) {
    return this._callMIoT('POST', `/miotspec/${command}`, {
      params,
      datasource,
    });
  }
}
