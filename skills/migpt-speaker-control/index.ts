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
    description: `通过小米音箱播放文字转语音（TTS）。

【音箱播报规范 - 调用此工具时必须遵守】

💬 播报时机：
收到用户消息后，可以先简短口头确认（如"好的"、"收到"、"明白"），再给出回答，让用户感知正在响应。

📢 播报原则：
1. 简短优先：单次播报控制在 100 字以内，超过请拆分多次调用或改用其他渠道
2. 纯文字：只传入适合语音播报的纯文字，不要包含 URL、代码、复杂格式
3. 自然口语：使用简短、清晰的口语表达，避免长句和复杂结构

🚫 不适合用此工具播报的内容（应改用其他渠道）：
- 代码片段、技术文档
- 长篇文章、报告（>300 字）
- 复杂数据表格、列表
- 图片、视频、文件等多媒体内容
- URL 链接、邮箱地址

✅ 正确使用示例：
- 短回复："好的，已为你设置明天早上 8 点的闹钟"
- 长内容分流："由于内容较长，详细报告已发送到你的手机/微信，请查看"
- 代码场景："代码已生成并发送到你的邮箱，请注意查收"`,
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: '要播放的文字内容（纯文字，适合语音播报，不超过 100 字）',
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
