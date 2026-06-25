# P3 授权音频与 OSS/CDN 投放方案

本方案覆盖 P3 第一项：原曲版权伴奏、教师示范音轨、OSS/CDN 和版权授权管理。

## 目标

- 任何原曲伴奏或教师示范音轨都必须先有授权登记，再允许在应用中显示为可用。
- 音频文件不打包进前端产物，通过 OSS/CDN 分发。
- 缺少授权、授权过期或 CDN 未配置时，应用必须降级为“需授权 / 授权过期 / 待配置 CDN”，不得误播放。

## 当前基础实现

- `src/app/audio/practiceAudioAssets.ts` 增加 `LicensedAudioGrant` 授权登记模型。
- `getPracticeAudioAssets(song, options)` 会根据授权状态、有效期和 CDN 基地址生成资源状态。
- `buildCdnAssetUrl(base, path)` 统一生成编码后的 CDN URL。
- `.env.example` 增加：
  - `VITE_FEATURE_LICENSED_AUDIO=false`
  - `VITE_AUDIO_CDN_BASE_URL=https://cdn.example.com/harmonica-audio`

## 授权登记字段

| 字段 | 说明 |
| --- | --- |
| `songId` | 对应曲目 ID |
| `kind` | `licensed-backing` 或 `licensed-demo` |
| `assetPath` | OSS/CDN 下的相对路径 |
| `label` | 应用中展示的音轨名称 |
| `rightsHolder` | 权利方或录制方 |
| `licenseId` | 授权合同、内部工单或录制授权编号 |
| `status` | `approved` / `pending` / `expired` |
| `validFrom` | 授权开始日期 |
| `expiresAt` | 可选，授权到期日期 |

## 发布前检查

- [ ] 每个 `approved` 音轨都有可追溯授权编号。
- [ ] `assetPath` 指向已上传并可访问的 OSS/CDN 文件。
- [ ] `VITE_AUDIO_CDN_BASE_URL` 指向正式 CDN 域名。
- [ ] `VITE_FEATURE_LICENSED_AUDIO` 只在授权和 CDN 均完成后开启。
- [ ] 抽样验证授权过期、缺 CDN 和未授权状态不会显示为可播放。

## 后续扩展

- 将授权登记迁移到运营 CMS，而不是写在前端配置中。
- 增加服务端授权审计和过期提醒。
- 伴奏播放从合成 Web Audio 扩展为可选授权音轨播放，并保留音画同步校准。
