# P3 运营 CMS 基础版方案

本方案覆盖 P3 “运营 CMS（曲库 / 谱面管理）”的基础能力。当前阶段先建立内容仓库和 API，不直接实现完整后台 UI。

## 目标

- 曲目、练习谱、学习轨道和授权音频使用统一内容模型。
- 前端可从 CMS 读取已发布内容；当 CMS 不可用时自动回退到静态内置数据。
- 内容更新具备草稿、发布、归档状态和 revision 冲突保护。
- 后续可以在此基础上建设运营后台、审核流、版权音频上架和内容报表。

## 内容模型

服务端新增 `content_items` 表：

| 字段 | 说明 |
| --- | --- |
| `id` | 内容 ID，例如曲目 ID 或谱面 ID |
| `content_type` | `song` / `practice-chart` / `learning-track` / `licensed-audio` |
| `payload_json` | 内容 JSON |
| `status` | `draft` / `published` / `archived` |
| `revision` | 内容版本号，用于冲突检测 |
| `updated_at` | 最近更新时间 |
| `published_at` | 发布时间 |

## API

```text
GET /api/content
GET /api/content?contentType=song
GET /api/content?includeDrafts=true

PUT /api/content/:contentType/:id
Authorization: Bearer <token>
```

公开读取默认只返回 `published` 内容。写入接口当前复用登录鉴权；后续应增加管理员角色和审计日志。

## 前端 fallback

`src/app/content/contentClient.ts` 提供：

- `buildStaticContentCatalog()`：内置曲库 / 谱面 / 学习轨道。
- `buildContentCatalog(items)`：将 CMS 内容转换成前端目录，缺失组自动回退静态数据。
- `fetchPublishedContentCatalog()`：读取 `/api/content`，失败时回退静态数据。

## 发布前检查

- [ ] 生产环境 `VITE_FEATURE_CONTENT_MANAGEMENT` 已按发布策略设置。
- [ ] CMS 内容至少覆盖曲目、谱面和学习轨道中的一个完整闭环。
- [ ] 草稿内容不会出现在公开 `/api/content`。
- [ ] 内容 revision 冲突能正确返回 409。
- [ ] 前端在 CMS 不可用时仍能使用静态内容进入练习。

## 后续扩展

- 增加管理员角色、内容审核、变更审计和回滚。
- 后台 UI 支持曲目、谱面、授权音频和课程路径编辑。
- 谱面保存前调用现有 chart validation，避免无效内容发布。
- 授权音频登记迁入 CMS，并增加授权到期提醒。
