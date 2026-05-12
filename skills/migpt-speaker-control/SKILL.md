# MiGPT 小爱音箱全能控制 Skill

## 概述

这个 Skill 为龙虾（OpenClaw）提供对小米小爱音箱的**完整控制能力**，包括：

- 🔊 **音量控制**：设置、获取音量
- 🎵 **播放控制**：播放文字、播放音频、暂停、停止、切换播放状态
- 🔌 **多协议支持**：MiNA 和 MIoT 两种播放协议
- ⚡ **即时执行**：龙虾可以随时调用这些能力，不需要等待消息回调

## 可用工具（Tools）

### 音量控制

#### 1. `set_volume` - 设置音量

设置小爱音箱的音量大小。

**参数：**
- `volume` (number, 必需)：音量大小，范围 6-100

**示例：**
```
将音量设置为 50
```

**返回：**
```json
{
  "success": true,
  "message": "音量已设置为 50"
}
```

#### 2. `get_volume` - 获取当前音量

获取小爱音箱的当前音量。

**参数：** 无

**示例：**
```
查询当前音量
```

**返回：**
```json
{
  "success": true,
  "volume": 65
}
```

---

### 播放控制

#### 3. `play_text` - 播放文字转语音

播放文字转语音内容。

**参数：**
- `text` (string, 必需)：要播放的文字内容

**示例：**
```
播放"您有一条新消息"
```

**返回：**
```json
{
  "success": true,
  "message": "文字已播放"
}
```

#### 4. `play_url` - 播放音频链接

播放指定 URL 的音频文件。

**参数：**
- `url` (string, 必需)：音频链接 URL

**示例：**
```
播放 https://example.com/music.mp3
```

**返回：**
```json
{
  "success": true,
  "message": "音频已播放"
}
```

#### 5. `pause_playback` - 暂停播放

暂停音箱当前的播放。

**参数：** 无

**示例：**
```
暂停播放
```

**返回：**
```json
{
  "success": true,
  "message": "已暂停播放"
}
```

#### 6. `stop_playback` - 停止播放

停止音箱当前的播放。

**参数：** 无

**示例：**
```
停止播放
```

**返回：**
```json
{
  "success": true,
  "message": "已停止播放"
}
```

#### 7. `toggle_playback` - 切换播放/暂停

在播放和暂停状态之间切换。

**参数：** 无

**示例：**
```
切换播放状态
```

**返回：**
```json
{
  "success": true,
  "message": "播放状态已切换"
}
```

---

### 高级播放（多协议支持）

#### 8. `play_with_mina` - MiNA 协议播放

使用 MiNA 协议播放文字转语音（对某些设备效果更好）。

**参数：**
- `text` (string, 必需)：要播放的文字内容

**说明：** MiNA 是小米音箱的原生协议，通常兼容性和稳定性更好。

**示例：**
```
用 MiNA 播放"收到了"
```

**返回：**
```json
{
  "success": true,
  "message": "文字已通过 MiNA 播放"
}
```

#### 9. `play_with_miot` - MIoT 协议播放

使用 MIoT 协议播放文字转语音（对某些智能家居设备支持更好）。

**参数：**
- `text` (string, 必需)：要播放的文字内容

**说明：** MIoT 是小米物联网标准协议，某些新设备或智能家居场景下可能表现更好。

**示例：**
```
用 MIoT 播放通知
```

**返回：**
```json
{
  "success": true,
  "message": "文字已通过 MIoT 播放"
}
```

---

### 对话历史查询

#### 10. `get_conversation_history` - 获取对话历史

获取小爱音箱的对话历史记录，支持分页查询。

**参数：**
- `limit` (number, 可选)：获取的记录数，默认 10，最多 100
- `timestamp` (number, 可选)：时间戳（毫秒），用于分页查询，获取该时间点之前的记录

**示例：**
```
获取最近 20 条对话记录
```

**返回：**
```json
{
  "success": true,
  "data": {
    "records": [
      {
        "query": "明天天气怎么样",
        "timestamp": 1715001234567,
        "answers": [
          {
            "type": "TTS",
            "content": "明天天气晴朗，最高温度..."
          }
        ]
      }
    ],
    "hasMore": true,
    "cursor": 1715001234567,
    "timestamp": 1715010234567
  }
}
```

#### 11. `get_last_conversation` - 获取最后一条对话

快速获取最后一条对话（用户提问和小爱回答）。

**参数：** 无

**示例：**
```
查看刚才和小爱的最后一条对话
```

**返回：**
```json
{
  "success": true,
  "data": {
    "query": "几点钟了",
    "timestamp": 1715001234567,
    "formattedTime": "2024/5/6 14:20:34",
    "answers": [
      {
        "type": "TTS",
        "content": "现在是下午2点20分"
      }
    ]
  }
}
```

#### 12. `search_conversation` - 搜索对话

搜索对话历史中包含特定关键词的记录。

**参数：**
- `keyword` (string, 必需)：搜索关键词
- `limit` (number, 可选)：最多查询多少条记录进行搜索，默认 50，最多 100

**示例：**
```
搜索所有包含"天气"的对话
```

**返回：**
```json
{
  "success": true,
  "data": {
    "keyword": "天气",
    "records": [
      {
        "query": "明天天气怎么样",
        "timestamp": 1715001234567,
        "formattedTime": "2024/5/6 14:20:34",
        "answers": [...]
      },
      {
        "query": "今天天气怎样",
        "timestamp": 1715001234500,
        "formattedTime": "2024/5/6 14:15:34",
        "answers": [...]
      }
    ],
    "total": 2
  }
}
```

---

## 使用场景

### 场景 1：温度提醒

```
当温度超过 30°C 时，调用 `play_text` 播放"当前温度过高，请开启空调"
```

### 场景 2：重要提醒

```
AI 生成的回复太长无法直接播报时：
1. 调用 `play_text` 播放简短提示："详细内容已发送到您的手机"
2. 通过其他 Channel（如微信）发送详细内容
```

### 场景 3：交互式控制

```
用户说"调小音量"：
1. 调用 `get_volume` 获取当前音量
2. 计算新音量值（减 10）
3. 调用 `set_volume` 设置新音量
4. 调用 `play_text` 播放"已将音量调小"
```

### 场景 4：多音箱协调

```
家中有多个音箱时：
1. 在正在播放的音箱上调用 `stop_playback`
2. 在新音箱上调用 `play_text` 播放内容
```

### 场景 5：查询对话历史

```
用户说"回放一下我们刚才说过什么"：
1. 调用 `get_last_conversation` 获取最后一条对话
2. 调用 `play_text` 播放用户的原始提问
3. 调用 `play_text` 播放小爱的原始回答
```

### 场景 6：搜索特定话题

```
用户说"告诉我前面问过关于天气的内容"：
1. 调用 `search_conversation` 搜索包含"天气"的对话
2. 将匹配结果整理成摘要
3. 调用 `play_text` 播放结果摘要
```

### 场景 7：对话数据分析

```
龙虾生成日报或周报时：
1. 调用 `get_conversation_history` 获取历史对话
2. 分析用户的提问趋势
3. 统计最频繁的问题类型
4. 生成对话分析报告
```

---

## 注意事项

### 1. 音量范围

- 最小音量：**6**
- 最大音量：**100**
- 设置超出范围的音量会导致失败

### 2. 播放协议选择

| 协议 | 适用场景 | 优势 |
|------|--------|------|
| MiNA | 标准小米音箱 | 原生协议，兼容性最好 |
| MIoT | 智能家居设备 | 标准物联网协议，跨品牌支持 |
| 自动（play_text） | 大多数情况 | 自动根据配置选择最优协议 |

### 3. 错误处理

所有工具都会返回 `success` 字段：
- `success: true` - 执行成功
- `success: false` - 执行失败，检查 `error` 字段获取详细错误信息

### 4. 网络依赖

- 所有命令都需要通过小米云端进行中转
- 确保设备与互联网连接正常
- 如果设备离线，命令会失败

---

## 与其他 Skill 的配合

### 与龙虾消息回复的关系

- **传统方式**：通过 `deliver` 回调被动播放 AI 回复
- **新方式**：通过这个 Skill 主动调用播放，龙虾可以：
  - 先播放"已收到"提示
  - 独立控制音量
  - 实现更复杂的交互逻辑

### 配合其他 Channel

配置示例：
```json
{
  "channels": {
    "migpt": {
      "devices": ["客厅音箱"]
    },
    "wechat": {
      // 微信 Channel 用于发送长内容
    }
  }
}
```

龙虾可以同时使用：
- `migpt-speaker-control` Skill：播放简短提示
- 微信 Channel：发送详细内容

---

## 故障排查

### 问题：播放命令不工作

**可能原因：**
1. 设备离线 → 检查网络连接
2. 账号登录过期 → 重新配置凭证
3. 设备不支持该协议 → 尝试换协议

**解决方案：**
```
1. 检查 OpenClaw 日志：是否有连接错误
2. 尝试调用 `get_volume` 测试连接
3. 如果 get_volume 成功但播放失败，可能是设备 spec 不同，联系支持
```

### 问题：音量设置无效

**可能原因：**
1. 音量值超出范围 (6-100)
2. 设备当前处于特殊状态（如通话中）

**解决方案：**
```
1. 使用 `get_volume` 获取当前值
2. 确保新值在 6-100 范围内
3. 检查设备状态
```

---

## API 文档

### 导入方式

```typescript
import { registerMigptSpeakerControlSkill } from 'migpt-claw/skills/migpt-speaker-control';
```

### 工具列表

| 工具名 | 功能 | 参数 | 返回值 |
|-------|------|------|-------|
| `set_volume` | 设置音量 | volume | success, message/error |
| `get_volume` | 获取音量 | - | success, volume/error |
| `play_text` | 播放文字 | text | success, message/error |
| `play_url` | 播放音频 | url | success, message/error |
| `pause_playback` | 暂停 | - | success, message/error |
| `stop_playback` | 停止 | - | success, message/error |
| `toggle_playback` | 切换播放/暂停 | - | success, message/error |
| `play_with_mina` | MiNA 播放 | text | success, message/error |
| `play_with_miot` | MIoT 播放 | text | success, message/error |
| `get_conversation_history` | 获取对话历史 | limit, timestamp | success, records/error |
| `get_last_conversation` | 获取最后一条对话 | - | success, query/answer/error |
| `search_conversation` | 搜索对话 | keyword, limit | success, records/error |

---

## 最佳实践

### 1. 始终检查返回值

```javascript
// ✅ 正确
const result = await callTool('play_text', { text: '你好' });
if (!result.success) {
  console.error('播放失败:', result.error);
}

// ❌ 不推荐
await callTool('play_text', { text: '你好' });
```

### 2. 优先使用高级工具

```javascript
// ✅ 推荐：自动根据配置选择最优协议
await callTool('play_text', { text: '你好' });

// ⚠️ 仅在明确需要时才用低级工具
await callTool('play_with_mina', { text: '你好' });
```

### 3. 组织复杂交互

```javascript
// ✅ 推荐：分步执行，便于调试
const volResult = await callTool('get_volume', {});
const newVol = volResult.volume - 10;
const setResult = await callTool('set_volume', { volume: newVol });
await callTool('play_text', { text: `已调至 ${newVol}` });

// ❌ 不推荐：无法知道中间哪一步失败
await Promise.all([...]);
```

### 4. 处理网络延迟

```javascript
// ✅ 为长操作设置超时
const timeoutPromise = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('超时')), 5000)
);
const result = await Promise.race([callTool(...), timeoutPromise]);
```

---

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0 | 2024 | 初始版本，提供完整的音箱控制能力 |

---

## 技术支持

如遇问题，请检查：
1. OpenClaw 日志
2. 设备连接状态
3. 小米账号登录状态
4. 网络连接

