# 小米智能家居设备控制 Skill

## 概述

这个 Skill 为龙虾（OpenClaw）提供对小米智能家居设备的**完整控制能力**，支持：

- 📱 **设备管理**：获取设备列表、查看在线状态
- 🔌 **属性操作**：获取和设置设备属性
- 🎬 **动作执行**：调用设备的各种动作
- 🔧 **RPC 调用**：直接调用底层 RPC 指令
- ⚡ **快捷操作**：灯光开关、亮度、色温等常用操作

支持的设备类型（所有支持 MIoT 协议的小米设备）：
- 💡 灯光（彩光灯、白光灯、灯带等）
- 🔌 智能插座
- 🌡️ 温度/湿度传感器
- 🚪 门窗传感器
- 🎚️ 调光开关
- ...以及任何 MIoT 协议设备

## 核心概念

### MIoT 协议基础

小米智能家居使用 MIoT（Mi Internet of Things）协议，基于以下概念：

- **siid** (Service ID)：服务 ID，表示设备的某个功能模块
- **piid** (Property ID)：属性 ID，表示该服务下的一个属性
- **aiid** (Action ID)：动作 ID，表示该服务下的一个可执行动作

**示例：**
```
灯光设备
├── Service (siid=2)：灯光服务
│   ├── Property (piid=1)：开关状态
│   ├── Property (piid=2)：亮度
│   └── Property (piid=3)：色温
├── Service (siid=3)：电源服务
│   └── Property (piid=1)：电源状态
```

### 如何查找 siid/piid

1. **米家 App 方式**：
   - 打开米家 App
   - 进入设备详情 → 更多设置 → 关于本设备
   - 查找"模型信息"中的规范定义

2. **官方文档**：
   - 访问 https://miot-spec.org/
   - 搜索你的设备型号
   - 查看 Service 和 Property 的 ID 定义

3. **反向工程**：
   - 使用米家官方提供的设备规范
   - 联系小米客服获取

---

## 可用工具（Tools）

### 设备管理

#### 1. `get_device_list` - 获取设备列表

获取账户下的所有小米设备列表。

**参数：** 无

**示例：**
```
列出所有小米设备
```

**返回：**
```json
{
  "success": true,
  "data": {
    "devices": [
      {
        "deviceId": "123456789",
        "name": "客厅灯",
        "model": "philips.light.bulb",
        "type": "light.color-bulb",
        "status": "online",
        "online": true,
        "category": "light"
      },
      {
        "deviceId": "987654321",
        "name": "书房插座",
        "model": "lumi.plug",
        "type": "switch.outlet",
        "status": "online",
        "online": true,
        "category": "switch"
      }
    ],
    "total": 2
  }
}
```

---

### 属性操作

#### 2. `get_property` - 获取属性值

获取 MIoT 设备的某个属性的当前值。

**参数：**
- `siid` (number, 必需)：Service ID
- `piid` (number, 必需)：Property ID

**示例：**
```
获取客厅灯的开关状态（假设 siid=2, piid=1）
```

**返回：**
```json
{
  "success": true,
  "data": {
    "siid": 2,
    "piid": 1,
    "value": true
  }
}
```

#### 3. `set_property` - 设置属性值

设置 MIoT 设备的某个属性值。

**参数：**
- `siid` (number, 必需)：Service ID
- `piid` (number, 必需)：Property ID
- `value` (任意类型, 必需)：要设置的值

**示例：**
```
将客厅灯的亮度设置为 80%（假设 siid=2, piid=2）
```

**返回：**
```json
{
  "success": true,
  "message": "属性已设置为 80",
  "data": {
    "siid": 2,
    "piid": 2,
    "value": 80
  }
}
```

---

### 动作执行

#### 4. `do_action` - 执行设备动作

调用 MIoT 设备的某个动作。

**参数：**
- `siid` (number, 必需)：Service ID
- `aiid` (number, 必需)：Action ID
- `args` (array, 可选)：动作的参数数组，默认为空

**示例：**
```
调用灯光的"渐进开启"动作，参数为 [100, 500]（亮度 100%，耗时 500ms）
```

**返回：**
```json
{
  "success": true,
  "message": "动作执行成功",
  "data": {
    "siid": 2,
    "aiid": 1,
    "args": [100, 500]
  }
}
```

---

### RPC 调用

#### 5. `rpc_call` - 直接调用 RPC 指令

直接调用 MIoT 设备的 RPC 指令（高级用法，需要对 MIoT 协议有深入了解）。

**参数：**
- `method` (string, 必需)：RPC 方法名
- `params` (object, 可选)：方法的参数对象
- `id` (number, 可选)：请求 ID，默认为 1

**示例：**
```
直接调用 RPC 方法获取设备状态
```

**返回：**
```json
{
  "success": true,
  "data": {
    "code": 0,
    "message": "ok",
    "result": { ... }
  }
}
```

---

### 快捷操作

#### 6. `smart_toggle` - 切换开关

快速切换设备的开关状态（开→关或关→开）。

**参数：**
- `siid` (number, 必需)：Service ID
- `piid` (number, 必需)：开关属性 ID（通常是 1）

**示例：**
```
切换客厅灯的开关
```

**返回：**
```json
{
  "success": true,
  "message": "已打开设备",
  "data": {
    "previousState": false,
    "currentState": true
  }
}
```

#### 7. `smart_brightness` - 调整亮度

调整灯光或其他设备的亮度。

**参数：**
- `siid` (number, 必需)：Service ID
- `piid` (number, 必需)：亮度属性 ID（通常是 2）
- `brightness` (number, 必需)：亮度值（0-100）

**示例：**
```
将书房灯的亮度调至 50%
```

**返回：**
```json
{
  "success": true,
  "message": "亮度已调至 50%",
  "data": {
    "siid": 2,
    "piid": 2,
    "brightness": 50
  }
}
```

#### 8. `smart_color_temperature` - 调整色温

调整灯光的色温（需要设备支持）。

**参数：**
- `siid` (number, 必需)：Service ID
- `piid` (number, 必需)：色温属性 ID
- `temperature` (number, 必需)：色温值（单位：开尔文，通常 1700-6500K）

**示例：**
```
将灯光色温调至 4000K（中性白）
```

**返回：**
```json
{
  "success": true,
  "message": "色温已调至 4000K",
  "data": {
    "siid": 2,
    "piid": 3,
    "temperature": 4000
  }
}
```

---

## 使用场景

### 场景 1：智能照明控制

```
用户说"把客厅灯调到 50% 亮度"：
1. 调用 `get_device_list` 查找"客厅灯"
2. 调用 `smart_brightness` 设置亮度为 50
3. 调用 `migpt_speaker_control.play_text` 播放确认
```

### 场景 2：晚间模式

```
用户说"启动晚间模式"：
1. 调用 `smart_brightness` 将卧室灯调至 30%
2. 调用 `smart_color_temperature` 将灯光调至 2700K（暖白）
3. 调用 `smart_toggle` 关闭客厅插座
4. 播放确认信息
```

### 场景 3：设备状态查询

```
用户说"告诉我有哪些设备在线"：
1. 调用 `get_device_list` 获取所有设备
2. 过滤出 online 为 true 的设备
3. 生成摘要并播放
```

### 场景 4：能源管理

```
龙虾检测到电费过高时：
1. 调用 `get_device_list` 获取所有插座
2. 遍历检查插座的功耗属性
3. 自动关闭低优先级设备
4. 报告节能结果
```

### 场景 5：场景化控制

```
用户说"执行离家模式"：
1. 关闭所有灯光 → `smart_toggle`
2. 关闭插座 → `smart_toggle`
3. 锁定门窗 → `do_action`
4. 播放确认
```

---

## 常见设备的 siid/piid 参考

### Philips Hue 彩光灯

| 功能 | siid | piid | 说明 |
|------|------|------|------|
| 开关 | 2 | 1 | true/false |
| 亮度 | 2 | 2 | 0-100 |
| 色温 | 2 | 3 | 1700-6500 |
| RGB 色彩 | 2 | 5 | RGB 值 |

### 小米智能插座

| 功能 | siid | piid | 说明 |
|------|------|------|------|
| 开关 | 2 | 1 | true/false |
| 功率 | 3 | 1 | W（瓦） |
| 电流 | 3 | 2 | A（安） |
| 电压 | 3 | 3 | V（伏） |

### 门窗传感器

| 功能 | siid | piid | 说明 |
|------|------|------|------|
| 门窗状态 | 3 | 1 | true=打开, false=关闭 |
| 电池电量 | 4 | 1 | 0-100 |

**注意：** 实际的 siid/piid 可能因设备型号而异，请参考具体的设备规范。

---

## API 文档

### 导入方式

```typescript
import { registerMigptSmartHomeSkill } from 'migpt-claw/skills/migpt-smart-home';
```

### 工具列表

| 工具名 | 功能 | 参数 | 返回值 |
|-------|------|------|-------|
| `get_device_list` | 获取设备列表 | - | success, devices/error |
| `get_property` | 获取属性值 | siid, piid | success, value/error |
| `set_property` | 设置属性值 | siid, piid, value | success, message/error |
| `do_action` | 执行动作 | siid, aiid, args | success, message/error |
| `rpc_call` | RPC 调用 | method, params | success, data/error |
| `smart_toggle` | 切换开关 | siid, piid | success, state/error |
| `smart_brightness` | 调整亮度 | siid, piid, brightness | success, message/error |
| `smart_color_temperature` | 调整色温 | siid, piid, temperature | success, message/error |

---

## 最佳实践

### 1. 始终检查服务初始化

```javascript
// ✅ 正确
const result = await callTool('get_device_list', {});
if (!result.success) {
  console.error('MIoT 服务未就绪:', result.error);
  return;
}

// 处理结果...
```

### 2. 缓存设备信息

```javascript
// ✅ 推荐：避免频繁调用 get_device_list
let deviceCache = null;
let cacheTime = 0;

async function getDevices() {
  const now = Date.now();
  if (deviceCache && now - cacheTime < 60000) { // 1 分钟缓存
    return deviceCache;
  }
  const result = await callTool('get_device_list', {});
  if (result.success) {
    deviceCache = result.data.devices;
    cacheTime = now;
  }
  return deviceCache;
}
```

### 3. 使用快捷工具而非通用工具

```javascript
// ❌ 不推荐：手动获取和设置
const current = await callTool('get_property', { siid: 2, piid: 1 });
const newValue = !current.data.value;
await callTool('set_property', { siid: 2, piid: 1, value: newValue });

// ✅ 推荐：直接切换
await callTool('smart_toggle', { siid: 2, piid: 1 });
```

### 4. 批量操作时添加延迟

```javascript
// ✅ 推荐：防止请求过密集
for (const device of devices) {
  await callTool('smart_toggle', { siid: device.siid, piid: 1 });
  await sleep(200); // 200ms 延迟
}
```

### 5. 错误处理和降级

```javascript
// ✅ 推荐：优雅降级
async function toggleLight(siid, piid) {
  try {
    const result = await callTool('smart_toggle', { siid, piid });
    if (!result.success) {
      console.warn('切换失败，尝试直接调用 RPC');
      // 降级方案...
    }
  } catch (err) {
    console.error('设备控制异常:', err);
    // 通知用户或重试
  }
}
```

---

## 故障排查

### 问题：`get_device_list` 返回空列表

**可能原因：**
1. 账号未登录或登录过期
2. 小米账号下没有设备
3. 设备未绑定到该账号

**解决方案：**
1. 检查 OpenClaw 日志确认 MIoT 服务初始化是否成功
2. 检查小米账号是否有有效的设备
3. 重新登录小米账号

### 问题：`set_property` 报错"属性 ID 无效"

**可能原因：**
1. siid 或 piid 输入错误
2. 该设备不支持该属性
3. 属性值类型不匹配（如发送字符串给数字属性）

**解决方案：**
1. 确认设备的正确 siid/piid（参考设备规范）
2. 检查属性类型定义
3. 使用正确的值类型

### 问题：设备离线时命令执行缓慢

**可能原因：**
1. 设备已离线，等待超时
2. 网络连接不稳定

**解决方案：**
1. 先调用 `get_device_list` 检查设备在线状态
2. 如果离线，给用户提示而不是执行命令
3. 检查网络连接

---

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0 | 2024 | 初始版本，提供完整的 MIoT 设备控制能力 |

---

## 技术支持

如遇问题，请检查：
1. MIoT 服务是否正确初始化
2. 设备是否在线
3. siid/piid 是否正确
4. 属性值类型是否匹配
5. 小米账号是否有效

