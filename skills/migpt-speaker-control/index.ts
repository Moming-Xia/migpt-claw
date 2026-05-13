import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { MiService } from '../../src/service.js';
import { MiSpeaker } from '../../src/speaker.js';
import { MiMessage } from '../../src/message.js';

/**
 * 小爱音箱全能控制技能
 * 提供对小米音箱的完整控制能力：播放、音量、播放控制等
 */
export function registerMigptSpeakerControlSkill(api: OpenClawPluginApi) {
  // ============ 音量控制 ============
  
  api.registerTool({
    name: 'set_volume',
    description: '设置小爱音箱的音量',
    inputSchema: {
      type: 'object',
      properties: {
        volume: {
          type: 'number',
          description: '音量大小（6-100）',
          minimum: 6,
          maximum: 100,
        },
      },
      required: ['volume'],
    },
    execute: async (input: { volume: number }) => {
      const result = await MiSpeaker.setVolume(input.volume);
      if (result.success) {
        return { success: true, message: `音量已设置为 ${input.volume}` };
      } else {
        return { success: false, error: result.error };
      }
    },
  });

  api.registerTool({
    name: 'get_volume',
    description: '获取小爱音箱的当前音量',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      const volume = await MiSpeaker.getVolume();
      if (volume !== undefined) {
        return { success: true, volume };
      } else {
        return { success: false, error: '获取音量失败' };
      }
    },
  });

  // ============ 播放控制 ============

  api.registerTool({
    name: 'play_text',
    description: '播放文字转语音',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: '要播放的文字内容',
        },
      },
      required: ['text'],
    },
    execute: async (input: { text: string }) => {
      const result = await MiSpeaker.play({ text: input.text });
      if (result.success) {
        return { success: true, message: '文字已播放' };
      } else {
        return { success: false, error: result.error };
      }
    },
  });

  api.registerTool({
    name: 'play_url',
    description: '播放音频链接',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: '音频链接 URL',
        },
      },
      required: ['url'],
    },
    execute: async (input: { url: string }) => {
      const result = await MiSpeaker.play({ url: input.url });
      if (result.success) {
        return { success: true, message: '音频已播放' };
      } else {
        return { success: false, error: result.error };
      }
    },
  });

  // ============ 播放暂停停止 ============

  api.registerTool({
    name: 'pause_playback',
    description: '暂停小爱音箱当前播放',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      const result = await MiSpeaker.pause();
      if (result.success) {
        return { success: true, message: '已暂停播放' };
      } else {
        return { success: false, error: result.error };
      }
    },
  });

  api.registerTool({
    name: 'stop_playback',
    description: '停止小爱音箱当前播放',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      const result = await MiSpeaker.stop();
      if (result.success) {
        return { success: true, message: '已停止播放' };
      } else {
        return { success: false, error: result.error };
      }
    },
  });

  api.registerTool({
    name: 'toggle_playback',
    description: '切换小爱音箱的播放/暂停状态',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      const result = await MiSpeaker.playOrPause();
      if (result.success) {
        return { success: true, message: '播放状态已切换' };
      } else {
        return { success: false, error: result.error };
      }
    },
  });

  // ============ 增强控制（MiService 提供） ============

  api.registerTool({
    name: 'play_with_mina',
    description: '使用 MiNA 协议播放文字转语音（对某些设备效果更好）',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: '要播放的文字内容',
        },
      },
      required: ['text'],
    },
    execute: async (input: { text: string }) => {
      const result = await MiService.playWithMina(input.text);
      if (result) {
        return { success: true, message: '文字已通过 MiNA 播放' };
      } else {
        return { success: false, error: 'MiNA 播放失败' };
      }
    },
  });

  api.registerTool({
    name: 'play_with_miot',
    description: '使用 MIoT 协议播放文字转语音（对某些智能家居设备支持更好）',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: '要播放的文字内容',
        },
      },
      required: ['text'],
    },
    execute: async (input: { text: string }) => {
      const result = await MiService.playWithMiot(input.text);
      if (result) {
        return { success: true, message: '文字已通过 MIoT 播放' };
      } else {
        return { success: false, error: 'MIoT 播放失败或不支持' };
      }
    },
  });

  // ============ 对话历史查询 ============

  api.registerTool({
    name: 'get_conversation_history',
    description: '获取小爱音箱的对话历史记录',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: '获取的记录数，默认 10，最多 100',
          minimum: 1,
          maximum: 100,
        },
        timestamp: {
          type: 'number',
          description: '时间戳（毫秒），用于分页查询，获取该时间点之前的记录',
        },
      },
      required: [],
    },
    execute: async (input: { limit?: number; timestamp?: number }) => {
      try {
        const deviceId = MiService.currentDeviceId;
        if (!deviceId) {
          return { success: false, error: '未找到配置的设备' };
        }

        const limit = Math.min(input.limit ?? 10, 100);
        const messages = await MiMessage.getHistoryMessages(deviceId, limit, input.timestamp);

        return {
          success: true,
          data: {
            records: messages.map((msg) => ({
              text: msg.text,
              timestamp: msg.timestamp,
              formattedTime: new Date(msg.timestamp).toLocaleString('zh-CN'),
            })),
            total: messages.length,
            timestamp: Date.now(),
          },
        };
      } catch (err: any) {
        return { success: false, error: err.message || '获取对话历史异常' };
      }
    },
  });

  api.registerTool({
    name: 'get_last_conversation',
    description: '获取最后一条对话（用户提问）',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      try {
        const deviceId = MiService.currentDeviceId;
        if (!deviceId) {
          return { success: false, error: '未找到配置的设备' };
        }

        const lastMessage = await MiMessage.getLastMessage(deviceId);

        if (!lastMessage) {
          return { success: false, error: '暂无对话记录' };
        }

        return {
          success: true,
          data: {
            text: lastMessage.text,
            timestamp: lastMessage.timestamp,
            formattedTime: new Date(lastMessage.timestamp).toLocaleString('zh-CN'),
          },
        };
      } catch (err: any) {
        return { success: false, error: err.message || '获取对话记录异常' };
      }
    },
  });

  api.registerTool({
    name: 'search_conversation',
    description: '搜索对话历史中包含特定关键词的记录',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
          description: '搜索关键词',
        },
        limit: {
          type: 'number',
          description: '最多查询多少条记录进行搜索，默认 50',
          minimum: 1,
          maximum: 100,
        },
      },
      required: ['keyword'],
    },
    execute: async (input: { keyword: string; limit?: number }) => {
      try {
        const deviceId = MiService.currentDeviceId;
        if (!deviceId) {
          return { success: false, error: '未找到配置的设备' };
        }

        const matchedMessages = await MiMessage.searchMessages(
          deviceId,
          input.keyword,
          input.limit,
        );

        return {
          success: true,
          data: {
            keyword: input.keyword,
            records: matchedMessages.map((msg) => ({
              text: msg.text,
              timestamp: msg.timestamp,
              formattedTime: new Date(msg.timestamp).toLocaleString('zh-CN'),
            })),
            total: matchedMessages.length,
          },
        };
      } catch (err: any) {
        return { success: false, error: err.message || '搜索对话异常' };
      }
    },
  });
}
