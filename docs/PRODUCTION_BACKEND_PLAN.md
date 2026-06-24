# 生产后端迁移方案

> 状态：P1 已完成迁移准备方案；开发环境继续保留 SQLite/sql.js 原型。  
> 更新日期：2026-06-24

## 目标

把当前本地原型后端迁移到可生产运营的架构：

- 数据库：SQLite/sql.js → PostgreSQL
- 部署：本地 HTTP → HTTPS
- 存储：浏览器本地为缓存，服务端为权威数据源
- 运维：备份、迁移、监控、回滚可执行

## 保留现状

当前 `server/database.ts` 的 `AppDatabase` 提供了最小 SQL 抽象：

- `run(sql, params)`
- `get(sql, params)`
- `all(sql, params)`
- `transaction(operation)`

这使得生产迁移可以先新增 PostgreSQL Adapter，而不是重写 API 层。

## 推荐生产架构

| 模块 | 方案 |
| --- | --- |
| API | Node.js + Express，保留当前路由 |
| Database | PostgreSQL 15+ |
| 连接池 | `pg` 或部署平台内置连接池 |
| 迁移工具 | `node-pg-migrate` / `drizzle-kit` / `prisma migrate` 三选一 |
| 密钥 | `JWT_SECRET`、SMTP、数据库 URL 使用平台 Secret |
| HTTPS | Vercel/Render/Fly.io/Nginx/Cloudflare 终止 TLS |
| 备份 | 每日自动快照 + 发布前手动快照 |

## 表结构映射

当前表可直接迁移：

- `users`
- `refresh_sessions`
- `password_reset_tokens`
- `practice_history`

PostgreSQL 建议调整：

- 时间字段从 `TEXT` 升级为 `TIMESTAMPTZ`
- `preferences_json`、`weak_measures_json` 升级为 `JSONB`
- `score`、`accuracy`、`revision` 保持 integer
- `id` 保持 text/uuid 均可；若切 uuid，需要前后端一起迁移

## 迁移步骤

1. 新增 `server/database.postgres.ts`
   - 实现与 `AppDatabase` 等价的接口。
   - 事务使用 `BEGIN / COMMIT / ROLLBACK` 或连接池 client。
2. 新增迁移脚本
   - `001_initial_schema.sql`
   - `002_indexes.sql`
3. 环境变量切换
   - `DATABASE_URL=postgres://...`
   - `DATABASE_DRIVER=postgres`
   - 未配置时继续使用 sql.js。
4. 灰度验证
   - 本地 API 测试跑 SQLite 和 PostgreSQL 两套。
   - 预览环境只接 PostgreSQL。
5. 生产发布
   - 发布前快照。
   - 部署后检查注册、登录、刷新 token、历史同步、密码重置。

## HTTPS 要求

麦克风能力依赖安全上下文：

- 本地开发：`localhost` 可用。
- 生产：必须 HTTPS。
- Cookie：生产使用 `secure: true` + `sameSite: none`，并限定 `APP_ORIGIN`。

## 回滚策略

- 应用回滚：回到上一版 API 镜像。
- 数据回滚：使用发布前快照恢复。
- Cookie/会话异常：可批量撤销 `refresh_sessions` 未撤销记录，强制用户重新登录。

## P1 交付边界

本阶段完成方案和接口边界确认，不直接替换运行时数据库。正式 PostgreSQL Adapter 建议作为 P2/P3 之间的独立高风险任务执行。

