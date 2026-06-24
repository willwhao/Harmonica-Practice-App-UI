# 音高检测线程化方案

> 状态：P1 已完成评估，并接入 Web Worker 最小原型。  
> 更新日期：2026-06-24

## 结论

当前优先采用 **Web Worker** 承载音高检测计算，AudioWorklet 作为后续升级路线。

原因：

- 现有算法是按 `AnalyserNode.getFloatTimeDomainData()` 获取帧数据后做自相关分析，天然适合丢给 Worker。
- Worker 接入成本低，不改变麦克风授权、校准和 React 状态结构。
- AudioWorklet 更适合低延迟音频采集与 DSP 管线，但需要 `audioWorklet.addModule()`、processor 通信、HTTPS 环境和更多浏览器兼容验证。

## 已落地

- `src/app/audio/pitchWorkerProtocol.ts`
  - 定义主线程与 Worker 的请求/响应协议。
  - 暴露 `analyzePitchFrame()`，方便 Node 测试复用。
- `src/app/audio/pitchDetection.worker.ts`
  - Worker 入口，接收音频帧并返回检测结果。
- `src/app/hooks/usePitchDetection.ts`
  - 支持 Worker 时将 pitch detection 放到 Worker。
  - Worker 不可用或繁忙时自动回退到主线程检测。
- `src/app/audio/pitchWorkerProtocol.test.ts`
  - 验证 Worker 协议可识别 A4 测试波形。

## 当前边界

- 采集仍在主线程通过 `AnalyserNode` 完成。
- Worker 只负责重计算的音高识别，不持有麦克风流。
- 起音、稳定度和 UI 状态仍由 Hook 汇总，避免 Worker 与 React 状态强耦合。

## 后续 AudioWorklet 升级条件

满足以下条件后再推进：

1. 真机浏览器验证 Worker 方案仍存在主线程卡顿。
2. 需要更稳定的固定帧率采样。
3. 生产环境已经强制 HTTPS。
4. 能接受 Safari / iOS 的专项兼容测试成本。

推荐 AudioWorklet 迁移顺序：

1. 新增 `pitch-processor.worklet.ts`，只输出 RMS 和 Float32 frame。
2. 主线程继续把 frame 转发给 Worker 识别，先不把检测算法塞进 Worklet。
3. 稳定后再评估是否把轻量检测也放入 Worklet。

