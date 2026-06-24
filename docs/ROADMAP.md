# 口琴练习室 — 项目路线图

> 技术路线、Refactor 优先级、口琴校准方案与多端迁移备忘。  
> 更新日期：2026-06-23

---

## 一、技术路线决策

| 决策 | 结论 | 理由 |
|------|------|------|
| 是否换 Vue | **否，继续 React** | 7 页 UI、hooks、测试、云同步已就绪；换框架约等于重写 2~3 个月 |
| React 不熟悉 | **边改边学即可** | 本项目只需 `useState` / `useEffect` / `useRef` + 组件 props |
| 多端规划 | **H5 先行，后期 uni-app / Capacitor** | 音频层各端差异大，先跑通 H5 核心 |
| 后端 | **保留 Node.js + Express 思路** | 换 PostgreSQL + OSS；类型可与前端共享 |
| 核心 refactor | **抽 engine 包 + 拆 PracticePage** | 问题在架构，不在框架 |

### Vue ↔ React 对照（够用即可）

| Vue 3 | React |
|-------|-------|
| `ref()` / `reactive()` | `useState()` |
| `computed()` | `useMemo()` |
| `watch()` | `useEffect()` |
| `onMounted()` | `useEffect(() => {}, [])` |
| Composables | Custom Hooks |
| `.vue` 单文件 | `.tsx` 函数组件 |

---

## 二、继续 React 的 Refactor 优先级清单

### P0 — 立刻做（1~2 周，收益最大）

- [x] 接入 **react-router**，替换 `App.tsx` 手工 `useState` 切页
- [x] URL 路由：`/`、`/prep/:songId`、`/practice`、`/results`、`/learning`、`/account`
- [x] 支持浏览器后退、刷新和基础分享链接
- [x] 拆分 `PracticePage.tsx`：
  - [x] `usePracticeSession` — 播放状态、开始 / 暂停 / 继续和练习计时
  - [x] `usePracticeSession` 后续增强 — 播放推进、循环 / 分段位置和进度派生从页面内迁出
  - [x] `usePracticeScoring` — 判定结果记录、得分、连击、计数与准确率计算
  - [x] `PracticeScoreboard` — 顶部歌曲状态、分数、准确率和进度条 UI
  - [x] `PracticeNoteLane` — 下落音符、轨道、判定线、反馈动画和开始遮罩
  - [x] `PracticeHoleGuide` — 孔位条与吹吸提示
  - [x] `PracticeControls` — 控制栏
- [x] 移除未使用依赖：删除未引用 UI 模板目录，卸载 `@mui/*`、Radix、Recharts 等模板包

### P1 — 短期（2~4 周）

- [ ] 将纯逻辑抽到 `src/engine/` 或独立包：
  - [ ] `pitchDetection.ts`
  - [x] `practiceWindow.ts` / `practiceInsights.ts`
  - [x] `practiceCharts.ts` 校验逻辑
  - [x] `practiceScoring.ts` / `recordingSegments.ts` / `scoreLayout.ts`
- [x] 音高检测迁移 **AudioWorklet** 或 Web Worker（减轻主线程压力）— 已选择 Web Worker 先行并接入最小原型，AudioWorklet 作为后续升级
- [x] 补全谱面：10 首歌至少 8 首有独立编配
- [x] 后端 SQLite → **PostgreSQL**（开发可用 Neon / Supabase）— 已完成生产迁移方案，运行时 Adapter 后续独立实施
- [x] 生产部署 **HTTPS**（移动端麦克风必需）— 已纳入生产后端迁移方案
- [x] 加深 E2E：完整练习流程 + 云端登录/账户入口

### P2 — 中期（1~2 月）

- [x] **口琴校准向导**（基础版：本地 Personal Pitch Profile + 练习判定偏移修正，见第三节）
- [ ] 新手引导流程（目标、口琴类型、麦克风说明）
- [ ] 书签 / 课程进度云同步
- [ ] 错误监控（Sentry）
- [x] CI/CD（GitHub Actions：`typecheck + lint + test + build`，已接入统一质量门禁）
- [ ] 正式隐私政策 / 用户协议文本

### P3 — 长期（多端 / 发布）

- [ ] uni-app 微信小程序（音频能力分级，见第四节）
- [ ] Capacitor 打包 Android / iOS
- [ ] 原曲版权伴奏 + OSS + CDN
- [ ] 运营 CMS（曲库 / 谱面管理）
- [ ] 经验值 / 徽章 / 月报

---

## 三、口琴校准功能方案

### 3.1 现状：只有「环境校准」

当前 `usePitchDetection.ts` 在启动麦克风后：

1. 请求麦克风权限
2. **calibrating**（约 1 秒，请保持安静）— 20 次 RMS 采样
3. 计算 `noiseFloor` → `minimumRms` 噪声门限
4. 进入 **listening** 开始识别

**已有**：环境噪声门限。  
**缺失**：针对「这支口琴 + 这个用户 + 这个麦克风」的音高映射校准。

### 3.2 目标

建立 **Personal Pitch Profile（个人音高校准表）**，解决：

| 问题 | 说明 |
|------|------|
| 环境噪声 | 已有（安静采样） |
| 输入电平 | 部分已有（RMS 门限） |
| 音高系统性偏差 | **待加** — 口琴略走音、谐波干扰、吹奏力度差异 |

### 3.3 校准 Profile 绑定方案（已选：方案 A）

**方案 A：每个用户一个 profile（简单）** — 当前采用。

- 实现成本低，适合 MVP
- 假设用户主要使用一把口琴
- 换口琴时在设置里「重新校准」即可

备选（后期可升级）：

- **方案 B**：多把口琴，每把独立 profile（更准，复杂）
- **方案 C**：只绑定「口琴类型 + 调性」（折中）

### 3.4 推荐校准流程

不建议抽象地「吹 1-7 七个音」— 十孔口琴在一个八度内无法吹出完整自然音阶。  
**按孔位引导 + 分音区锚点** 更合适。

```
┌─────────────────────────────────────────────────────────┐
│         口琴校准向导（首次 / 换琴 / 设置里）              │
└─────────────────────────────────────────────────────────┘

  Step 0  选口琴
  ─────────────
  十孔 / 半音阶 │ 调性 C/G/... │ （可选）品牌型号

  Step 1  环境静音（复用现有逻辑）
  ─────────────
  「请保持安静 2 秒」→ noiseFloorRms

  Step 2  低音区锚点（2~3 个音）
  ─────────────
  「请吹 4 孔吹气」→ 期望 C4  → 记录 detectedFreq, confidence
  「请吹 4 孔吸气」→ 期望 D4  → 记录 ...

  Step 3  中音区锚点（3~4 个音）
  ─────────────
  「请吹 6 孔吹气」→ 期望 G4
  「请吹 7 孔吹气」→ 期望 C5
  ...

  Step 4  高音区锚点（2~3 个音，可选）
  ─────────────
  「请吹 7 孔吹气（高音）」→ 期望 C5/C6

  Step 5  完成
  ─────────────
  生成 CalibrationProfile → 存 localStorage / 云端
  显示：「校准完成，平均偏差 ±X 音分」
```

**时长目标**：30~60 秒（MVP 可先做 3 个锚点：低 C4、中 G4、高 C5，约 15 秒）。

### 3.5 数据结构（建议）

```typescript
interface CalibrationAnchor {
  hole: number;
  breath: 'blow' | 'draw';
  targetNote: string;        // 例如 "C4"
  targetHz: number;
  detectedHz: number;
  centsOffset: number;       // detected vs target
  confidence: number;
  stabilityCents: number;
}

interface InstrumentCalibration {
  id: string;
  harmonicaType: 'diatonic' | 'chromatic';
  key: string;
  noiseFloorRms: number;
  anchors: CalibrationAnchor[];
  averageCentsOffset: number;
  createdAt: string;
  expiresAt?: string;        // 建议 30 天提醒重校
}
```

**练习判定时使用：**

```
目标音符 targetHz
        │
        ▼
  查最近音区 anchor 插值 → correctionOffset
        │
        ▼
  adjustedDetected = detectedHz - correctionOffset
        │
        ▼
  cents = 1200 * log2(adjustedDetected / targetHz)
        │
        ▼
  |cents| < 阈值 → Perfect / Great / ...
```

### 3.6 触发时机

| 时机 | 推荐 | 说明 |
|------|------|------|
| 首次进入 App | ✅ | 与新手引导合并 |
| 每次练习前 | ❌ | 太频繁，用户会跳过 |
| PrepPage 换口琴 / 调性 | ✅ | profile 不匹配时提示 |
| 设置页「重新校准」 | ✅ | 随时可进 |
| 练习中识别率持续低 | 🧪 | 智能提示「要重新校准吗？」 |

### 3.7 与现有代码的集成点

```
┌──────────────────┐     ┌─────────────────────┐
│ CalibrationWizard│────▶│ calibrationStore    │
│ (新页面/组件)     │     │ localStorage + 云同步 │
└────────┬─────────┘     └──────────┬──────────┘
         │                          │
         ▼                          ▼
┌──────────────────┐     ┌─────────────────────┐
│ usePitchDetection│◀────│ applyCalibration()  │
│ (扩展，非重写)    │     │ 纯函数，放 engine/  │
└────────┬─────────┘     └─────────────────────┘
         │
         ▼
┌──────────────────┐
│ PracticePage     │
│ 判定时用校准偏移  │
└──────────────────┘
```

### 3.8 风险与应对

| 风险 | 应对 |
|------|------|
| 用户吹不准导致校准数据脏 | 每步要求 `stabilityCents` 低于阈值且置信度 > 0.7，否则重吹 |
| 十孔缺音无法测全 7 音 | 按孔位引导，不测不存在的音 |
| 校准一次用很久不准 | 30 天过期提醒；换口琴强制重校 |
| 小程序 / Web 行为不一致 | 校准层抽象接口，H5 先做 |
| 校准过程太长 | 最少 5 个锚点；全量 7 音放「高级校准」 |

---

## 四、多端迁移备忘（后期）

```
H5 (React/Vite)          ← 当前，实时识别 ✅
    │
    ├── Capacitor App    ← 包 H5，音频仍用 Web Audio
    │
    └── uni-app 小程序    ← 实时识别难，可能降级为「练完评分」
```

| 平台 | 实时麦克风 + 音高分析 |
|------|----------------------|
| H5（Chrome / Safari） | Web Audio API，相对成熟 |
| 微信小程序 | 无完整 Web Audio，实时 FFT / 基频检测受限 |
| Android / iOS App | 原生 AudioRecord / AVAudioEngine，或 Capacitor 插件 |

**策略**：H5 做完整实时模式；小程序第一版可只做跟谱 + 练后评分。

---

## 五、建议架构（Monorepo 方向，重做或渐进迁移均可）

```
packages/
  engine/          ← 练习引擎（谱面、判定、分段、得分）— 框架无关
  audio-web/       ← H5 音频采集 + 音高检测
  audio-mp/        ← 小程序音频（后期）

apps/
  h5/              ← React + Vite（当前项目）
  miniapp/         ← uni-app（后期）

server/            ← Express API（已有，可升级 PostgreSQL）
```

---

## 六、现项目可保留 vs 可放弃

| 保留 | 放弃 / 重写 |
|------|-------------|
| `pitchDetection.ts` | `PracticePage` 单体结构 |
| `practiceCharts.ts` Schema | 未使用的 MUI 依赖 |
| `practiceWindow.ts` / `practiceInsights.ts` | `App.tsx` 手工路由 |
| `server/` 认证与同步设计 | sql.js 生产方案 |
| `cloudClient.ts` | — |
| 测试与性能预算脚本 | — |

---

## 七、后端与部署阶段

### 后端 API（第一阶段最小集）

```
POST   /auth/register | /login | /refresh | /logout
POST   /auth/forgot-password | /reset-password
GET    /users/me
PATCH  /users/me
DELETE /users/me

GET    /charts
GET    /charts/:id

GET    /history?since=
PUT    /history/:id
DELETE /history/:id

GET    /bookmarks
PUT    /bookmarks/:id
```

### 部署阶段

| 阶段 | 内容 |
|------|------|
| 开发 / 内测 | Vite dev；单台 VPS 或 Railway；PostgreSQL；OSS |
| 小规模公测 | CDN 静态部署；Redis；HTTPS；Sentry |
| 正式运营 | 伴奏 CDN；数据库备份；CI/CD；监控告警 |

**麦克风相关**：生产 H5 必须 **HTTPS**；局域网 dev 可用 `vite.config.ts` 中 `server.host: true`。

---

## 八、建议时间线（参考）

```
Month 1 — 打地基
  monorepo / engine 抽离（或先在 src/engine）
  react-router + 简化练习页结构
  1 首歌完整闭环 + HTTPS 部署

Month 2 — 核心体验
  完整练习引擎 + AudioWorklet
  音符级反馈 + 云端同步
  4 首独立谱面 + 真机测试

Month 3 — 产品化
  口琴校准向导 + 学习中心完善
  E2E + CI + 错误监控

Month 4+ — 多端扩展
  uni-app 小程序 / Capacitor App
  内容 CMS + 合规文档
```

---

## 九、相关文档

- [README.md](../README.md) — 功能状态与开发说明
- [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) — 发布检查清单
- [ROLLBACK_PLAN.md](./ROLLBACK_PLAN.md) — 回滚计划

---

## 十、待办记录（OpenSpec / 变更提案）

后续可单独开 change proposal：

- `instrument-calibration` — 口琴校准向导实现
- `react-router-migration` — URL 路由迁移
- `practice-page-split` — PracticePage 拆分
