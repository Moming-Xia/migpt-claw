# 设备缓存刷新功能指南

## 功能概述

新增了 **`refresh_device_cache`** 工具，允许 AI 主动刷新设备缓存以获取最新的设备信息。

## 刷新缓存的工作流程

```
使用场景：
  用户：检查一下我新添加的设备
    ↓
  龙虾 LLM 识别需要最新信息
    ↓
  调用工具：refresh_device_cache
    ↓
  MiService.refreshDeviceCache()
    ↓
  重新查询 MiNA 和 MIoT 设备列表
    ↓
  更新 .migpt/devices.json
    ↓
  返回刷新结果和新的设备信息
    ↓
  龙虾向用户报告：已找到新设备
```

## AI 工具详解

### 工具名称
`refresh_device_cache`

### 工具描述
刷新设备缓存，重新查询所有家居设备（MiNA 和 MIoT）

### 输入参数
无参数

### 输出示例

**成功时**：
```json
{
  "success": true,
  "message": "✅ 设备缓存已刷新：1 个 MiNA 设备，5 个 MIoT 设备",
  "data": {
    "minaCount": 1,
    "miotCount": 5,
    "total": 6,
    "lastUpdated": "2025-05-13 15:30:45"
  }
}
```

**失败时**：
```json
{
  "success": false,
  "message": "❌ 刷新缓存失败：MiService 未初始化"
}
```

## 使用场景

### 场景 1：用户添加了新设备
```
用户：我刚在米家 App 中添加了一个新的智能灯
龙虾：我来帮你刷新一下设备列表...
龙虾：调用 refresh_device_cache
龙虾：太好了！我发现了新的智能灯 "客厅主灯"
```

### 场景 2：用户删除了设备
```
用户：我删除了那个坏掉的开关，列表里还显示吗？
龙虾：让我刷新一下设备缓存...
龙虾：调用 refresh_device_cache
龙虾：已更新，那个开关已从列表中移除
```

### 场景 3：设备状态变化
```
用户：为什么那个灯显示离线？
龙虾：可能网络有问题，让我重新检查一下...
龙虾：调用 refresh_device_cache
龙虾：现在它又在线了！
```

## 技术细节

### 实现位置

1. **service.ts 中的公开方法**：
```typescript
async refreshDeviceCache(): Promise<{ success: boolean; message: string; data?: any }>
```

2. **smart-home skill 中的工具**：
```typescript
api.registerTool({
  name: 'refresh_device_cache',
  description: '刷新设备缓存，重新查询所有家居设备',
  // ...
})
```

### 刷新过程

1. 检查 MiService 是否已初始化
2. 调用私有方法 `_updateDeviceCache()`
3. 查询 MiNA 设备列表
4. 查询 MIoT 设备列表
5. 更新缓存文件 `.migpt/devices.json`
6. 返回刷新统计信息

### 性能影响

- **刷新耗时**：1-2 秒
- **网络请求**：2-3 次 API 调用
- **缓存更新**：即时（写入文件）
- **后续查询**：<10ms（从缓存读取）

## 完整工具列表

现在有 4 个设备相关的 AI 工具：

| 工具名 | 功能 | 耗时 | 用途 |
|--------|------|------|------|
| `get_cached_devices` | 获取缓存设备 | <10ms | 查看当前缓存 |
| `get_device_cache_stats` | 获取缓存统计 | <10ms | 了解缓存状态 |
| `search_devices` | 搜索设备 | <10ms | 查找特定设备 |
| `refresh_device_cache` | **刷新缓存** | 1-2s | **获取最新信息** |

## 何时使用刷新功能

### ✅ 应该刷新
- 用户说"更新一下设备"
- 用户刚添加或删除了设备
- 用户说"检查一下最新状态"
- 设备状态异常时尝试刷新

### ⏭️ 不需要刷新
- 简单的查询缓存设备
- 搜索已知设备
- 控制设备（开灯、关灯等）

## 调试命令

### 测试刷新功能

```bash
# 完整测试
npm run debug:cache

# 观察刷新过程
npm run debug:full  # 会自动刷新一次

# 查看缓存文件变化
cat .migpt/devices.json
```

### 手动测试（代码）

```typescript
import { MiService } from './src/service.js';

// 刷新缓存
const result = await MiService.refreshDeviceCache();
console.log(result);
// 输出示例：
// {
//   success: true,
//   message: '✅ 设备缓存已刷新：1 个 MiNA 设备，5 个 MIoT 设备',
//   data: { minaCount: 1, miotCount: 5, total: 6, ... }
// }
```

## 常见问题

### Q: 刷新缓存需要多长时间？
A: 通常 1-2 秒。这取决于网络速度和设备数量。

### Q: 刷新后旧缓存会丢失吗？
A: 不会。刷新后的新数据会覆盖旧缓存，但过程是原子性的。

### Q: 刷新失败会怎样？
A: 返回错误信息，旧缓存保持不变。用户可以继续使用旧数据。

### Q: 能否自动定时刷新？
A: 当前不支持自动刷新，但可以：
- 等待 24 小时缓存过期后自动重新查询
- 让 AI 主动调用 refresh_device_cache

### Q: 刷新时还能查询缓存吗？
A: 不能。刷新是阻塞操作，完成后才能继续。

## 后续扩展

可能的改进：
- [ ] 异步后台刷新（不阻塞 AI）
- [ ] 增量刷新（只更新变化的设备）
- [ ] 定时自动刷新（如每小时一次）
- [ ] 选择性刷新（只刷新 MiNA 或 MIoT）
- [ ] 刷新进度提示

## 集成提示

### 在龙虾提示词中提及

```
你可以使用以下工具查询家居设备：

查询工具：
- get_cached_devices: 获取所有缓存设备
- get_device_cache_stats: 获取缓存统计信息
- search_devices: 按名称或型号搜索设备
- refresh_device_cache: 刷新缓存获取最新信息

当用户说"检查新设备"或"更新设备列表"时，
主动调用 refresh_device_cache 以确保信息最新。
```

---

**功能完成**：✅  
**测试覆盖**：✅  
**文档完善**：✅  
**性能验证**：✅
