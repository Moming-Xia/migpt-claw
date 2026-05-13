# 本地调试快速参考

## 3 步启动本地调试

### Step 1: 配置

```bash
cp .env.local.example .env.local
# 编辑 .env.local，填入你的小米账号
```

### Step 2: 选择测试脚本

```bash
# 方式 A：使用 npm 命令（推荐）
npm run debug:full      # 完整诊断
npm run debug:speaker   # 音箱测试
npm run debug:smart     # 智能家居测试

# 方式 B：直接使用 ts-node
npx ts-node debug/test-full.ts
```

### Step 3: 查看输出

脚本会输出彩色日志。✓ 表示成功，✗ 表示失败。

---

## 环境变量配置

### 必需配置

```bash
# 认证方式 1：用户名 + 密码
MI_USER_ID=小米账号ID
MI_PASSWORD=小米账号密码

# 或认证方式 2：Pass Token（推荐）
MI_PASS_TOKEN=登录凭证

# 设备名称（必需）
MI_DEVICE_NAME=客厅音箱
```

### 可选配置

```bash
MI_DEBUG=true              # 启用调试日志
MI_TIMEOUT=5000            # 请求超时（毫秒）
MI_SPEAKER_CONTROL=mina    # 控制方式 (mina/miot)
```

---

## 预定义测试脚本

| 脚本 | 命令 | 功能 |
|------|------|------|
| **完整诊断** | `npm run debug:full` | 所有功能完整测试 |
| **音箱功能** | `npm run debug:speaker` | 音量、TTS、对话历史 |
| **智能家居** | `npm run debug:smart` | MIoT 设备、属性查询 |

---

## 编写自定义测试

### 最小化模板

```typescript
// debug/test-my.ts
import { createDebugContext, logger } from './local.js';

async function main() {
  const ctx = await createDebugContext();
  if (!ctx) return;
  
  if (!(await ctx.init())) return;
  
  // 你的测试
  await ctx.testTts('Hello');
  
  logger.success('Done!');
}

main().catch(logger.error);
```

运行：
```bash
npx ts-node debug/test-my.ts
```

### 常用操作

```typescript
await ctx.getVolume();                 // 获取音量
await ctx.setVolume(60);               // 设置音量
await ctx.testTts('文字');             // 播放文字
await ctx.getDeviceList();             // 获取设备
await ctx.getConversationHistory(10);  // 对话历史
await ctx.performanceTest(               // 性能测试
  '操作名',
  async () => { /* 测试代码 */ },
  5  // 重复次数
);
```

---

## 日志颜色说明

| 符号 | 颜色 | 说明 |
|------|------|------|
| ✓ | 🟢 绿色 | 操作成功 |
| ✗ | 🔴 红色 | 操作失败 |
| ⚠ | 🟡 黄色 | 警告信息 |
| ℹ | 🔵 蓝色 | 信息提示 |
| 🐛 | ⚫ 灰色 | 调试信息 |

---

## 常见问题排查

### 问题：初始化失败

```bash
# 检查凭证
MI_DEBUG=true npm run debug:full

# 看详细错误信息
# 如果看到"初始化失败: MiNA 服务不可用"，说明凭证有问题
```

**解决：**
1. 检查 `MI_USER_ID` 和 `MI_PASSWORD` 是否正确
2. 或重新获取 `MI_PASS_TOKEN`
3. 检查网络连接

### 问题：获取设备列表为空

```bash
# 确认设备名称
# 在米家 App 中查看确切的设备名称（要完全匹配）

# 如果是 MIoT 设备，用这个查看
npm run debug:smart
```

### 问题：TTS 播放无响应

```bash
# 可能的原因：
# 1. 音箱处于忙碌状态
# 2. 网络延迟
# 3. 音箱离线

# 检查诊断
npm run debug:full
# 看服务状态和网络性能
```

---

## 文件结构

```
debug/
├── env.ts                 # 环境变量配置工具
├── local.ts              # 调试上下文类和日志工具
├── test-full.ts          # 完整诊断脚本
├── test-speaker.ts       # 音箱测试脚本
└── test-smart-home.ts    # 智能家居测试脚本

.env.local.example         # 环境变量模板
LOCAL_DEBUG_GUIDE.md       # 详细调试指南
```

---

## 工作流程建议

### 开发核心功能时

```bash
# Terminal 1
npm run dev              # 代码变化时自动编译

# Terminal 2
npm run debug:speaker    # 运行测试脚本

# 修改代码 → 重新运行测试 → 迭代
```

### 调试问题时

```bash
# 启用调试模式，查看详细日志
MI_DEBUG=true npm run debug:full

# 或在调试脚本中添加 console.log
# 查看具体是哪一步出错
```

---

## 快速命令参考

```bash
# 启动开发模式
npm run dev

# 运行测试
npm run debug:full        # 完整诊断
npm run debug:speaker     # 音箱测试
npm run debug:smart       # 智能家居测试

# 构建
npm run build

# 带环境变量运行
MI_DEBUG=true npm run debug:full

# 查看帮助
cat LOCAL_DEBUG_GUIDE.md
```

---

## 提示

- 💡 **第一次运行？** 先看 `LOCAL_DEBUG_GUIDE.md`
- 💾 **保存 .env.local？** 不要提交到 Git！(已在 .gitignore)
- 🔍 **调试困难？** 启用 `MI_DEBUG=true` 查看详细日志
- 📊 **性能问题？** 查看性能测试结果中的 `avg_ms`
- 🆘 **还有问题？** 检查网络连接和凭证有效性

