# 发布检查清单

本清单用于第 7 阶段“运营与正式发布”。每次准备发布前，先完成本地检查，再交给 CI 复核。

## 1. 代码与质量门禁

- [ ] 已确认工作分支包含本次发布的全部改动。
- [ ] 已执行 `npm run quality`。
- [ ] 已执行 `npm run check:release`。
- [ ] 生产构建 `dist/` 已生成，且性能预算通过。
- [ ] Playwright E2E 在 Chrome/Edge 移动视口通过。

## 2. 环境与密钥

- [ ] 生产环境已配置 HTTPS。
- [ ] `VITE_APP_VERSION` 与本次发布版本一致。
- [ ] `VITE_RELEASE_CHANNEL` 已设置为 `production`、`preview` 或 `development`。
- [ ] 实验性功能开关已按发布范围确认，尤其是上传音频识谱和运营状态面板。
- [ ] 若使用远程功能开关，已抽样验证 `/api/release-config`、灰度比例和环境变量紧急覆盖均符合预期。
- [ ] 若开启授权音频投放，已确认 `VITE_FEATURE_LICENSED_AUDIO`、`VITE_AUDIO_CDN_BASE_URL` 和授权登记均有效。
- [ ] 若开启运营 CMS，已确认 `VITE_FEATURE_CONTENT_MANAGEMENT`、公开内容列表和静态 fallback 均可用。
- [ ] `VITE_MONITORING_ENDPOINT`、`VITE_MONITORING_SAMPLE_RATE` 与远端错误监控开关已确认。
- [ ] `JWT_SECRET` 使用 32 字符以上随机密钥，未提交到仓库。
- [ ] `APP_ORIGIN` 指向正式域名。
- [ ] SMTP 配置可发送密码重置邮件。
- [ ] 数据库路径、备份路径和恢复流程已确认。

## 3. 内容、版权与隐私

- [ ] `ATTRIBUTIONS.md` 已更新第三方资源与许可证。
- [ ] 原曲谱面、伴奏、示范音轨已经过授权核对。
- [ ] CMS 已发布内容经过曲库、谱面和课程路径抽样校验，草稿内容不会公开展示。
- [ ] 授权音频状态已抽样验证：未授权、授权过期和缺 CDN 时不会显示为可播放。
- [x] 隐私政策、用户协议、版本号和生效日期已准备（见 `docs/PRIVACY_POLICY.md` 与 `docs/TERMS_OF_SERVICE.md`）。
- [ ] 麦克风、上传音频、录音回放的数据处理说明已在界面或文档中保留。
- [ ] 数据导出和账户注销流程已验证。

## 4. 发布与回滚

- [ ] 已记录当前版本号和提交 SHA。
- [ ] 已创建 Git tag。
- [ ] 已准备发布说明。
- [ ] 已确认上一个稳定版本的回滚 tag。
- [ ] 已确认静态资源/CDN 缓存刷新策略。

## 5. 发布后观察

- [ ] 观察登录、注册、找回密码、练习、上传音频和历史同步。
- [ ] 检查错误监控、服务健康检查和 API 日志。
- [ ] 已验证 `/api/monitoring/events` 或外部 Sentry/同类平台能收到前端错误事件。
- [ ] 已验证 `/api/ops/summary` 的用户、练习、内容和灰度开关摘要与本次发布预期一致。
- [ ] 记录首屏加载、移动端练习流畅度和异常反馈。
- [ ] 如果出现严重问题，按 `docs/ROLLBACK_PLAN.md` 执行回滚。
