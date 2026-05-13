# 小米智能家居设备控制 Skill

## 概述

这个 Skill 为龙虾（OpenClaw）提供对小米智能家居设备的**完整控制能力**，支持：

- 🔍 **设备发现**：搜索设备、查看设备支持的协议
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

---

## 核心概念

### MiNA 与 MIoT 协议区别

小米设备使用两种不同的通信协议，设备在缓存中会标识其支持的协议类型：

| 特性 | MiNA 协议 | MIoT 协议 |
|------|-----------|-----------|
| **全称** | Mi Network Audio | Mi Internet of Things |
| **适用设备** | 小爱音箱等语音设备 | 智能家居设备（灯、插座、传感器等） |
| **核心能力** | TTS 播放、音量控制、媒体播放、对话轮询 | 属性读写（siid/piid）、动作调用（aiid）、RPC |
| **数据模型** | 基于 ubus 服务调用 | 基于 siid/piid/aiid 的规范模型 |
| **设备标识** | `deviceID`（UUID 格式） | `did`（数字 ID） |
| **通信方式** | HTTP API + WebSocket | HTTP API（加密） |
| **本 Skill 支持** | ⚠️ 仅设备发现，不支持属性控制 | ✅ 完整支持属性读写、动作调用 |

**重要提示：**
- **MiNA 设备**（如小爱音箱）不支持 siid/piid 属性读写操作，只能通过 speaker-control skill 进行 TTS 播放、音量控制等
- **MIoT 设备**（如智能灯、插座）支持完整的属性读写和动作调用，是本 Skill 的主要控制对象
- 每个设备在缓存中都有 `protocol` 字段标识其协议类型，工具调用时会**自动校验协议兼容性**

### MIoT 协议基础

小米智能家居使用 MIoT（Mi Internet of Things）协议，基于以下概念：

- **siid** (Service ID)：服务 ID，表示设备的某个功能模块
- **piid** (Property ID)：属性 ID，表示该服务下的一个属性
- **aiid** (Action ID)：动作 ID，表示该服务下的一个可执行动作

**示例：**
```
灯光设备（MIoT 协议）
├── Service (siid=2)：灯光服务
│   ├── Property (piid=1)：开关状态
│   ├── Property (piid=2)：亮度
│   └── Property (piid=3)：色温
├── Service (siid=3)：电源服务
│   └── Property (piid=1)：电源状态
```

### 如何查找设备 ID 和 siid/piid

1. **先找到设备 ID**：
   - 调用 `find_device` 搜索设备名称，获取 `id` 和 `protocol`
   - 或调用 `get_cached_devices` 查看所有设备

2. **再查找 siid/piid**：
   - **米家 App 方式**：打开米家 App → 设备详情 → 更多设置 → 关于本设备 → 查找"模型信息"
   - **官方文档**：访问 https://miot-spec.org/ 搜索设备型号
   - **反向工程**：使用米家官方提供的设备规范

---

## 可用工具（Tools）

### 设备发现

#### 1. `find_device` - 搜索设备（推荐首先调用）

搜索设备并返回设备信息（含支持的协议标识）。**控制设备前应先调用此工具确认设备及其协议。**

**参数：**
- `keyword` (string, 必需)：搜索关键词（设备名称、型号、MAC 地址或设备 ID）

**示例：**
```
搜索"客厅灯"
```

**返回：**
```json
{
  "success": true,
  "data": {
    "devices": [
      {
        "id": "1126316381",
        "name": "客厅灯",
        "model": "philips.light.bulb",
        "protocol": "miot",
        "online": true
      }
    ],
    "total": 1,
    "hint": "找到设备「客厅灯」，协议: miot，可使用其 id 调用控制工具"
  }
}
```

**注意：** 如果设备的 `protocol` 为 `mina`，说明这是 MiNA 协议设备（如小爱音箱），不支持本 Skill 的属性读写操作，应使用 speaker-control skill。

---

### 设备缓存

#### 2. `get_cached_devices` - 获取缓存设备列表

获取缓存的所有家居设备列表（含协议标识）。

**参数：** 无

**返回：**
```json
{
  "success": true,
  "data": {
    "devices": [
      {
        "id": "a7e7cc2b-...",
        "name": "Xiaomi 智能音箱 Pro",
        "protocol": "mina",
        "online": true
      },
      {
        "id": "1126316381",
        "name": "客厅灯",
        "protocol": "miot",
        "online": true
      }
    ],
    "minaCount": 1,
    "miotCount": 1,
    "total": 2
  }
}
```

#### 3. `get_device_cache_stats` - 获取缓存统计

获取设备缓存的统计信息。

**参数：** 无

#### 4. `search_devices` - 搜索设备（按协议分组）

搜索指定名称或型号的设备（按协议分组返回）。

**参数：**
- `keyword` (string, 必需)：搜索关键词

#### 5. `refresh_device_cache` - 刷新设备缓存

刷新设备缓存，重新查询所有家居设备。

**参数：** 无

---

### 属性操作

#### 7. `get_property` - 获取属性值

获取 MIoT 设备的某个属性的当前值。**自动根据设备 ID 选择协议，MiNA 设备会返回协议不兼容提示。**

**参数：**
- `siid` (number, 必需)：Service ID
- `piid` (number, 必需)：Property ID
- `did` (string, 可选)：目标设备 ID（不传则使用默认音箱设备）

**示例：**
```
获取客厅灯的开关状态（假设 did="1126316381", siid=2, piid=1）
```

**返回：**
```json
{
  "success": true,
  "data": {
    "did": "1126316381",
    "siid": 2,
    "piid": 1,
    "value": true,
    "protocol": "miot"
  }
}
```

**错误示例（MiNA 设备）：**
```json
{
  "success": false,
  "error": "设备 xxx 使用 MiNA 协议，不支持属性读写操作（siid/piid）。MiNA 设备仅支持 TTS 播放、音量控制等功能"
}
```

#### 8. `set_property` - 设置属性值

设置 MIoT 设备的某个属性值。**自动根据设备 ID 选择协议。**

**参数：**
- `siid` (number, 必需)：Service ID
- `piid` (number, 必需)：Property ID
- `value` (任意类型, 必需)：要设置的值
- `did` (string, 可选)：目标设备 ID

**示例：**
```
将客厅灯的亮度设置为 80%（假设 did="1126316381", siid=2, piid=2）
```

**返回：**
```json
{
  "success": true,
  "message": "属性已设置为 80",
  "data": {
    "did": "1126316381",
    "siid": 2,
    "piid": 2,
    "value": 80,
    "protocol": "miot"
  }
}
```

---

### 动作执行

#### 9. `do_action` - 执行设备动作

调用 MIoT 设备的某个动作。**自动根据设备 ID 选择协议。**

**参数：**
- `siid` (number, 必需)：Service ID
- `aiid` (number, 必需)：Action ID
- `args` (array, 可选)：动作的参数数组，默认为空
- `did` (string, 可选)：目标设备 ID

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
    "did": "1126316381",
    "siid": 2,
    "aiid": 1,
    "args": [100, 500],
    "protocol": "miot"
  }
}
```

---

### RPC 调用

#### 10. `rpc_call` - 直接调用 RPC 指令

直接调用 MIoT 设备的 RPC 指令（高级用法，需要对 MIoT 协议有深入了解）。**自动根据设备 ID 选择协议。**

**参数：**
- `method` (string, 必需)：RPC 方法名
- `params` (object, 可选)：方法的参数对象
- `did` (string, 可选)：目标设备 ID

**示例：**
```
直接调用 RPC 方法获取设备状态
```

---

### 快捷操作

#### 11. `smart_toggle` - 切换开关

快速切换设备的开关状态（开→关或关→开）。**必须提供设备 ID，自动校验协议。**

**参数：**
- `siid` (number, 必需)：Service ID
- `piid` (number, 必需)：开关属性 ID（通常是 1）
- `did` (string, 必需)：目标设备 ID

**示例：**
```
切换客厅灯的开关（did="1126316381"）
```

**返回：**
```json
{
  "success": true,
  "message": "已打开设备",
  "data": {
    "did": "1126316381",
    "previousState": false,
    "currentState": true,
    "protocol": "miot"
  }
}
```

#### 12. `smart_brightness` - 调整亮度

调整灯光或其他设备的亮度。**必须提供设备 ID，自动校验协议。**

**参数：**
- `siid` (number, 必需)：Service ID
- `piid` (number, 必需)：亮度属性 ID（通常是 2）
- `brightness` (number, 必需)：亮度值（0-100）
- `did` (string, 必需)：目标设备 ID

**示例：**
```
将书房灯的亮度调至 50%（did="1126316381"）
```

#### 13. `smart_color_temperature` - 调整色温

调整灯光的色温。**必须提供设备 ID，自动校验协议。**

**参数：**
- `siid` (number, 必需)：Service ID
- `piid` (number, 必需)：色温属性 ID
- `temperature` (number, 必需)：色温值（单位：开尔文，通常 1700-6500K）
- `did` (string, 必需)：目标设备 ID

---

## 使用场景

### 场景 1：智能照明控制

```
用户说"把客厅灯调到 50% 亮度"：
1. 调用 `find_device` 搜索"客厅灯" → 获取 id 和确认 protocol="miot"
2. 调用 `smart_brightness` 设置亮度为 50（传入 did）
3. 调用 `migpt_speaker_control.play_text` 播放确认
```

### 场景 2：晚间模式

```
用户说"启动晚间模式"：
1. 调用 `find_device` 搜索所有灯光设备
2. 调用 `smart_brightness` 将卧室灯调至 30%
3. 调用 `smart_color_temperature` 将灯光调至 2700K（暖白）
4. 调用 `smart_toggle` 关闭客厅插座
5. 播放确认信息
```

### 场景 3：设备状态查询

```
用户说"告诉我有哪些设备在线"：
1. 调用 `get_cached_devices` 获取所有设备（含协议标识）
2. 过滤出 online 为 true 的设备
3. 生成摘要并播放
```

### 场景 4：处理 MiNA 设备

```
用户说"把音箱音量调大"：
1. 调用 `find_device` 搜索"音箱" → protocol="mina"
2. 告知用户这是 MiNA 协议设备，应使用 speaker-control skill
3. 调用 `migpt_speaker_control.set_volume` 调整音量
```

### 场景 5：场景化控制

```
用户说"执行离家模式"：
1. 调用 `find_device` 搜索所有可控设备
2. 关闭所有灯光 → `smart_toggle`（传入各设备的 did）
3. 关闭插座 → `smart_toggle`
4. 锁定门窗 → `do_action`
5. 播放确认
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

## 工具列表

| 工具名 | 功能 | 必需参数 | 协议要求 |
|-------|------|---------|---------|
| `find_device` | 搜索设备（含协议） | keyword | 无 |
| `get_cached_devices` | 获取缓存设备列表 | - | 无 |
| `get_device_cache_stats` | 获取缓存统计 | - | 无 |
| `search_devices` | 搜索设备（按协议分组） | keyword | 无 |
| `refresh_device_cache` | 刷新设备缓存 | - | 无 |
| `get_property` | 获取属性值 | siid, piid | MIoT |
| `set_property` | 设置属性值 | siid, piid, value | MIoT |
| `do_action` | 执行动作 | siid, aiid | MIoT |
| `rpc_call` | RPC 调用 | method | MIoT |
| `smart_toggle` | 切换开关 | siid, piid, did | MIoT |
| `smart_brightness` | 调整亮度 | siid, piid, brightness, did | MIoT |
| `smart_color_temperature` | 调整色温 | siid, piid, temperature, did | MIoT |

---

## 最佳实践

### 1. 先用 find_device 确认设备和协议

```javascript
// ✅ 正确：先确认设备协议
const device = await callTool('find_device', { keyword: '客厅灯' });
if (device.data.devices[0].protocol === 'mina') {
  // MiNA 设备，引导使用 speaker-control skill
} else {
  // MIoT 设备，可以使用属性控制
  await callTool('smart_toggle', { siid: 2, piid: 1, did: device.data.devices[0].id });
}

// ❌ 错误：直接操作未确认协议的设备
await callTool('smart_toggle', { siid: 2, piid: 1, did: 'some-id' });
```

### 2. 始终传递 did 参数

```javascript
// ✅ 正确：传递目标设备 ID
await callTool('set_property', { siid: 2, piid: 2, value: 80, did: '1126316381' });

// ⚠️ 可行但不够精确：使用默认设备
await callTool('set_property', { siid: 2, piid: 2, value: 80 });
```

### 3. 处理协议不兼容

```javascript
// ✅ 推荐：优雅处理协议不兼容
const result = await callTool('get_property', { siid: 2, piid: 1, did: deviceId });
if (!result.success && result.error.includes('MiNA')) {
  console.warn('该设备使用 MiNA 协议，请使用 speaker-control skill');
}
```

### 4. 使用快捷工具而非通用工具

```javascript
// ❌ 不推荐：手动获取和设置
const current = await callTool('get_property', { siid: 2, piid: 1, did });
const newValue = !current.data.value;
await callTool('set_property', { siid: 2, piid: 1, value: newValue, did });

// ✅ 推荐：直接切换
await callTool('smart_toggle', { siid: 2, piid: 1, did });
```

### 5. 批量操作时添加延迟

```javascript
// ✅ 推荐：防止请求过密集
for (const device of devices) {
  await callTool('smart_toggle', { siid: device.siid, piid: 1, did: device.id });
  await sleep(200); // 200ms 延迟
}
```

---

## 故障排查

### 问题：工具返回"MiNA 协议，不支持属性读写操作"

**原因：** 你正在尝试对一个 MiNA 协议设备（如小爱音箱）使用 MIoT 的属性操作。

**解决方案：**
1. 使用 `find_device` 确认设备协议
2. MiNA 设备请使用 speaker-control skill 的 TTS、音量控制等功能
3. 只有 MIoT 设备才能使用本 Skill 的属性控制功能

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
1. 先调用 `get_cached_devices` 检查设备在线状态
2. 如果离线，给用户提示而不是执行命令
3. 检查网络连接

---

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.1 | 2025 | 添加协议标识（MiNA/MIoT），支持设备 ID 指定目标设备，自动协议校验 |
| 1.0 | 2024 | 初始版本，提供完整的 MIoT 设备控制能力 |

---

## 技术支持

如遇问题，请检查：
1. 设备支持的协议类型（MiNA 或 MIoT）
2. MIoT 服务是否正确初始化
3. 设备是否在线
4. siid/piid 是否正确
5. 属性值类型是否匹配
6. 小米账号是否有效
