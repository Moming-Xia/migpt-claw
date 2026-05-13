# 本地调试指南

这份指南说明如何在本地调试 migpt-claw 的核心功能（MiService、MiSpeaker 等）。

## 快速开始

### 1. 配置环境变量

```bash
# 复制模板文件
cp .env.local.example .env.local

# 编辑 .env.local，填入你的小米账号信息
nano .env.local
```

**必要配置：**
- `MI_USER_ID` 或 `MI_PASS_TOKEN` - 小米账号信息
- `MI_PASSWORD` - 密码（如果使用用户名登录）
- `MI_DEVICE_NAME` - 设备名称（如"客厅音箱"）

### 2. 运行调试脚本

```bash
# 完整诊断测试
npx ts-node debug/test-full.ts

# 仅测试音箱功能
npx ts-node debug/test-speaker.ts

# 仅测试智能家居设备
npx ts-node debug/test-smart-home.ts
```

### 3. 查看输出

脚本会输出彩色日志，显示服务状态和测试结果。

---

## 配置详解

### 认证方式

有两种方式进行认证：

#### 方式 1：用户名 + 密码（简单但不够安全）

```bash
MI_USER_ID=你的小米ID
MI_PASSWORD=你的小米密码
```

#### 方式 2：PassToken（推荐，更安全）

```bash
MI_PASS_TOKEN=登录凭证Token
```

**如何获取 PassToken：**

1. 打开米家 App，登录小米账号
2. 用浏览器打开 https://account.xiaomi.com
3. 打开浏览器 DevTools (F12)
4. 在 Network 标签中找到任意请求
5. 查看 Request Headers 中的 `serviceToken` 或 Cookie 中的相关字段
6. 复制到 `MI_PASS_TOKEN`

### 其他配置

| 环境变量 | 说明 | 默认值 | 示例 |
|---------|------|--------|------|
| `MI_DEVICE_NAME` | 设备名称（必需） | - | `客厅音箱` |
| `MI_DEBUG` | 启用调试日志 | false | true |
| `MI_TIMEOUT` | 请求超时（毫秒） | 5000 | 10000 |
| `MI_SPEAKER_CONTROL` | 控制方式 | mina | miot |

---

## 调试脚本说明

### test-full.ts - 完整诊断

测试所有功能，包括：
- ✓ 服务初始化
- ✓ 服务状态诊断
- ✓ 音量操作
- ✓ TTS 播放
- ✓ 设备列表
- ✓ 对话历史
- ✓ 性能基准

**运行：**
```bash
npx ts-node debug/test-full.ts
```

### test-speaker.ts - 音箱功能测试

测试音箱相关功能：
- ✓ 获取音量
- ✓ 设置音量
- ✓ TTS 播放
- ✓ 对话历史
- ✓ 性能测试

**运行：**
```bash
npx ts-node debug/test-speaker.ts
```

### test-smart-home.ts - 智能家居测试

测试 MIoT 设备控制：
- ✓ 获取设备列表
- ✓ 获取 MIoT 设备
- ✓ 属性查询示例
- ✓ 性能测试

**运行：**
```bash
npx ts-node debug/test-smart-home.ts
```

---

## 编写自定义测试

### 基础模板

```typescript
import { createDebugContext, logger } from './debug/local.js';

async function main() {
  // 创建调试上下文
  const ctx = await createDebugContext();
  if (!ctx) return;

  // 初始化服务
  if (!(await ctx.init())) {
    logger.error('初始化失败');
    return;
  }

  // 执行测试
  logger.section('测试功能');
  
  // 你的测试代码...
  await ctx.testTts('Hello');
  
  logger.success('测试完成');
}

main().catch(logger.error);
```

### 常用方法

```typescript
// 获取音量
await ctx.getVolume();

// 设置音量
await ctx.setVolume(50);

// 播放文字
await ctx.testTts('这是测试');

// 获取设备列表
await ctx.getDeviceList();

// 获取对话历史
await ctx.getConversationHistory(10);

// 性能测试
await ctx.performanceTest('操作名称', async () => {
  // 测试代码
}, 5);

// 诊断
await ctx.diagnose();
```

### 日志输出

```typescript
import { logger } from './debug/local.js';

logger.title('标题');           // 大标题
logger.section('小标题');       // 小标题
logger.success('成功信息');     // 绿色成功
logger.error('错误信息', err);  // 红色错误
logger.warning('警告信息');     // 黄色警告
logger.info('信息', data);      // 蓝色信息
logger.debug('调试信息', data); // 灰色调试
```

---

## 常见问题

### Q: 提示"缺少必要的环境变量配置"

**A:** 确保设置了以下环境变量：
```bash
# 要么
MI_USER_ID=xxx MI_PASSWORD=xxx MI_DEVICE_NAME=xxx

# 要么
MI_PASS_TOKEN=xxx MI_DEVICE_NAME=xxx
```

### Q: 初始化失败，提示"MiNA 服务不可用"

**A:** 可能是：
1. 网络连接有问题
2. 小米账号凭证过期
3. 设备名称输入错误

**解决：**
```bash
# 使用最新的凭证重新配置 .env.local
# 检查网络连接
# 确认设备名称与米家 App 中的名称完全相同
```

### Q: 获取对话历史时提示"暂无对话记录"

**A:** 这可能是正常的，取决于：
1. 是否最近与小爱进行过对话
2. 对话历史是否已被清除
3. 设备是否记录对话

### Q: 性能测试很慢

**A:** 可能是：
1. 网络延迟
2. 小米服务器响应缓慢
3. 超时设置太长

**调试步骤：**
```typescript
// 启用调试模式查看详细日志
MI_DEBUG=true npx ts-node debug/test-full.ts

// 降低超时时间（如果网络确实很快）
MI_TIMEOUT=3000 npx ts-node debug/test-full.ts
```

---

## 高级用法

### 直接使用服务类

```typescript
import { MiService } from './src/service.js';
import { MiSpeaker } from './src/speaker.js';
import { loadConfigFromEnv } from './debug/env.js';

const { config, deviceName } = loadConfigFromEnv();

// 初始化
await MiService.init(config, deviceName);

// 使用 MiNA 服务
const conversations = await MiService.MiNA?.getConversations({ limit: 10 });

// 使用 MiOT 服务（智能家居设备）
const devices = await MiService.MiOT?.getDevices();

// 使用 MiSpeaker
await MiSpeaker.play({ text: '你好' });
```

### 添加自定义日志

所有使用 `console.log` 的地方都会输出日志。

如需更结构化的日志，参考 `LocalDebugContext` 的实现。

---

## 工作流程建议

### 开发音箱功能时

```bash
# Terminal 1: 监听代码变化
npm run dev

# Terminal 2: 运行测试脚本
npx ts-node debug/test-speaker.ts

# Terminal 3: 修改代码并重新运行测试
```

### 开发智能家居功能时

```bash
# 1. 首先运行 test-smart-home.ts 探索设备
npx ts-node debug/test-smart-home.ts

# 2. 记下要控制的设备的 siid/piid

# 3. 修改 test-smart-home.ts 中的属性查询测试
await ctx.testMiotProperty(2, 1);  // 改为你的设备参数

# 4. 运行测试验证
npx ts-node debug/test-smart-home.ts

# 5. 在核心代码中实现功能
```

---

## 调试建议

### 1. 启用调试模式

```bash
MI_DEBUG=true npx ts-node debug/test-full.ts
```

### 2. 检查网络

```bash
# 测试与小米服务器的连接
ping api2.mina.mi.com
ping api.io.mi.com
```

### 3. 查看凭证是否有效

```bash
# 在 .env.local 中临时设置
MI_PASS_TOKEN=wrong_token

# 运行测试
npx ts-node debug/test-full.ts

# 应该看到"初始化失败"的明确错误信息
```

### 4. 逐步隔离问题

```typescript
// 只测试初始化
const ctx = await createDebugContext();
const initOk = await ctx.init();
logger.info('Init result:', initOk);

// 只测试一个操作
await ctx.getVolume();

// 添加更多日志
console.log('Before operation...');
const result = await MiSpeaker.play({ text: 'test' });
console.log('After operation:', result);
```

---

## 总结

本地调试系统提供了：
- ✅ 环境变量配置管理
- ✅ 多个预定义的测试脚本
- ✅ 灵活的日志系统
- ✅ 性能测试工具
- ✅ 快速诊断功能

现在你可以快速开发和测试 MiService、MiSpeaker 等核心功能！
