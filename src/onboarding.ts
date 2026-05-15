import type { ChannelOnboardingAdapter } from 'openclaw/plugin-sdk';
import { MiService } from './service.js';
import type { MiServiceConfig } from './service.js';
import { DEFAULT_WAKE_WORDS, DEFAULT_EXIT_WORDS } from './conversation.js';

export const miGPTOnboardingAdapter: ChannelOnboardingAdapter = {
  async selectAccount({ accounts }: { accounts: string[] }) {
    if (accounts.length === 0) {
      return { action: 'create' };
    }
    if (accounts.length === 1) {
      return { action: 'use', accountId: accounts[0] };
    }
    return { action: 'select' };
  },

  async promptCredentials() {
    // 这些方法由 OpenClaw 框架在运行时提供
    const answers: any = {};

    answers.userId = await (this as any).prompt.input({
      message: '请输入你的小米 ID（数字，在小米账号「个人信息」-「小米 ID」查看）:',
      validate: (v: string) => /^\d+$/.test(v) || '小米 ID 必须是数字',
    });

    const usePassToken = await (this as any).prompt.confirm({
      message: '是否使用 passToken 登录？（推荐，可避免验证码）',
      initial: false,
    });

    if (usePassToken) {
      answers.passToken = await (this as any).prompt.password({
        message: '请输入 passToken:',
        validate: (v: string) => !!v || 'passToken 不能为空',
      });
    } else {
      answers.password = await (this as any).prompt.password({
        message: '请输入小米账号密码:',
        validate: (v: string) => !!v || '密码不能为空',
      });
    }

    answers.deviceName = await (this as any).prompt.input({
      message: '请输入小爱音箱在米家中设置的名称（如：客厅音箱）:',
      validate: (v: string) => !!v || '设备名称不能为空',
    });

    const defaultWakeStr = DEFAULT_WAKE_WORDS.join('、');
    const defaultExitStr = DEFAULT_EXIT_WORDS.join('、');

    answers.wakeWords = await (this as any).prompt.input({
      message: `自定义唤醒词（可选）—— 内置默认：${defaultWakeStr}\n  多个词用空格或逗号分隔，自定义词会与默认词合并生效。直接回车则仅使用默认词：`,
      initial: '',
    });

    answers.exitWords = await (this as any).prompt.input({
      message: `自定义退出词（可选）—— 内置默认：${defaultExitStr}\n  多个词用空格或逗号分隔，自定义词会与默认词合并生效。直接回车则仅使用默认词：`,
      initial: '',
    });

    return answers;
  },

  async validateCredentials({ input }: { input: any }) {
    const config: MiServiceConfig = {
      userId: input.userId,
      password: input.password,
      passToken: input.passToken,
      debug: true,
    };

    try {
      const devices = await MiService.getDevices(config);
      
      if (devices.length === 0) {
        return {
          valid: false,
          error: '未找到任何设备，请检查账号凭证是否正确',
        };
      }

      const deviceName = input.deviceName;
      const matchedDevice = devices.find(
        (d) => d.name.toLowerCase() === deviceName.toLowerCase() || 
               d.did.toLowerCase() === deviceName.toLowerCase()
      );

      if (!matchedDevice) {
        const deviceList = devices.map((d) => d.name).join(', ');
        return {
          valid: false,
          error: `未找到设备 "${deviceName}"。可用设备：${deviceList}`,
        };
      }

      return {
        valid: true,
        data: {
          did: matchedDevice.did,
        },
      };
    } catch (err: any) {
      return {
        valid: false,
        error: err.message || '验证失败',
      };
    }
  },

  applyConfig({ cfg, accountId, input, validatedData }: { cfg: any; accountId?: string; input: any; validatedData?: any }) {
    const migptCfg = cfg.channels?.migpt ?? {};
    
    // 解析用户输入的自定义词（空格、中英文逗号均支持）
    const parseWords = (raw: string): string[] | undefined => {
      const words = raw.split(/[\s,，]+/).map((w) => w.trim()).filter(Boolean);
      return words.length > 0 ? words : undefined;
    };

    const accountConfig: Record<string, any> = {
      userId: input.userId,
      password: input.password,
      passToken: input.passToken,
      devices: [validatedData?.did || input.deviceName],
      enabled: true,
    };

    const customWakeWords = parseWords(input.wakeWords ?? '');
    const customExitWords = parseWords(input.exitWords ?? '');
    // 仅写入用户自定义部分；ConversationManager 运行时会自动与内置默认词合并
    if (customWakeWords) accountConfig.wakeWords = customWakeWords;
    if (customExitWords) accountConfig.exitWords = customExitWords;

    const isDefault = !accountId || accountId === 'main';

    if (isDefault) {
      return {
        ...cfg,
        channels: {
          ...cfg.channels,
          migpt: {
            ...migptCfg,
            ...accountConfig,
          },
        },
      };
    }

    return {
      ...cfg,
      channels: {
        ...cfg.channels,
        migpt: {
          ...migptCfg,
          accounts: {
            ...migptCfg.accounts,
            [accountId]: accountConfig,
          },
        },
      },
    };
  },
};
