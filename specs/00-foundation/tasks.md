# R00 基础设施：数据模型、GitHub 客户端、错误码、测试框架 - 任务清单

> 完成一项后把 `- [ ]` 改为 `- [✅]`

- [✅] 1. 新增 `GithubUser` 模型并生成迁移
  - 说明：新建 `packages/db/prisma/schema/github-user.prisma`（PRD 第 5 节原样）；按 requirements.md「已确认决策」D1 准备数据库：在同一 PostgreSQL 实例上新建 `zyk_aws_admin`，把 `apps/server/.env` 里 `DATABASE_URL` 的库名改成 `zyk_aws_admin`（只改库名，不提交 `.env`，旧库 `postgres` 不做任何写操作）；然后执行 `pnpm run db:migrate`（迁移名 `init`，同时包含 auth 表和 `github_user` 表），再执行 `pnpm run db:generate`；确认 `auth.prisma` 无改动
  - 对应验收标准：R00-AC1
  - 测试：`cd packages/db && npx prisma validate && npx prisma migrate status && npx prisma migrate diff --from-config-datasource --to-schema prisma/schema --exit-code && pnpm run check-types`，`pnpm run db:generate`，通过（第 1 轮）
- [✅] 2. 引入 Vitest 和测试库
  - [✅] 2.1 `pnpm-workspace.yaml` 的 catalog 加 `vitest`；`packages/api` 加 devDependency 和 `"test": "vitest run"`；根 `package.json` 加 `"test": "turbo run test"`；`turbo.json` 加 `test` 任务
  - [✅] 2.2 新建 `packages/db/src/testing.ts`：推导 `<库名>_test` 地址（即 `zyk_aws_admin_test`）、不存在时建库、执行 `prisma migrate deploy`、提供 `createTestDatabase()` 和 `resetTestDatabase()`
  - [✅] 2.3 新建 `packages/api/vitest.config.ts`，`globalSetup` 调用 2.2 的准备逻辑
  - 对应验收标准：R00-AC2
  - 测试：`pnpm run test`（turbo → packages/api `varlock run --path ../db/ -- vitest run`，src/test-database.test.ts 5 个用例），`pnpm exec turbo run check-types --filter=@zyk-aws-admin/api --filter=@zyk-aws-admin/db`，`pnpm exec ultracite check`（本批改动文件），通过（第 1 轮）
- [✅] 3. 共享校验规则 `packages/api/src/github/schemas.ts`
  - 说明：用户名、搜索关键字、备注、标签规则；GitHub 搜索响应、用户资料响应的 Zod 定义（只保留需要的字段）。文件只依赖 `zod`；web 通过 `@zyk-aws-admin/api/github/schemas` 运行时导入（现有 `exports` 的 `./*` 已覆盖，这是 web 唯一允许运行时导入的 api 文件，见 requirements.md「已确认决策」D2）
  - 对应验收标准：R00-AC10
  - 测试：`pnpm run test`（packages/api 现有 5 个用例；schemas 的单元测试在任务 8.3），`pnpm exec turbo run check-types --filter=@zyk-aws-admin/api`，`pnpm exec ultracite check packages/api/src/github/schemas.ts`，另用 `node --experimental-strip-types` 临时脚本冒烟验证用户名/关键字边界、备注/标签归一化、GitHub 响应解析 22 项，通过（第 1 轮）
- [✅] 4. 错误码和 `errorFormatter`
  - 说明：新建 `packages/api/src/errors.ts`（`AppCode`、`AppErrorCause`、`appError()`）；`packages/api/src/index.ts` 的 `create()` 加 `errorFormatter`
  - 对应验收标准：R00-AC11
  - 测试：`pnpm run test`（packages/api 现有 5 个用例），`pnpm exec turbo run check-types --filter=...@zyk-aws-admin/api`（api 及依赖方 server/web/native 共 7 个任务），`pnpm exec ultracite check packages/api/src/errors.ts packages/api/src/index.ts`，另用临时 vitest 用例（`createCallerFactory` + `getErrorShape`）冒烟验证 `appError` 格式化后 `data.appCode`/`data.resetAt` 正确、普通错误两者为 `null`，用后已删除（正式用例在任务 8.4），通过（第 1 轮）
- [ ] 5. GitHub 客户端
  - [ ] 5.1 `packages/api/src/github/cache.ts`：60 秒 TTL、最多 500 条、淘汰最早条目，可注入 `now`
  - [ ] 5.2 `packages/api/src/github/client.ts`：请求头、token、10 秒超时、状态码映射、Zod 校验、缓存策略（`searchUsers`/`getUserByLogin` 默认缓存，`getUserByLogin(…, { cache: false })` 和 `getUserById` 不走缓存）
  - [ ] 5.3 `packages/api/src/github/mapper.ts`：GitHub 资料 → Prisma 写入数据；记录 → 接口输出（日期转 ISO 字符串）
  - 对应验收标准：R00-AC3、R00-AC4、R00-AC5、R00-AC6、R00-AC7、R00-AC8、R00-AC9
- [ ] 6. 上下文、环境变量和 router 骨架
  - 说明：`apps/server/.env.schema` 加可选敏感的 `GITHUB_TOKEN` 并执行 `pnpm run env:generate`；`turbo.json` 的 `globalEnv` 加 `GITHUB_TOKEN`；`packages/api/src/context.ts` 加 `github`；`apps/server/src/services.ts` 创建 `github` 单例；`apps/server/src/context.ts` 传入；新建 `packages/api/src/routers/github-user.ts`（空 router）并合并进 `appRouter`
  - 对应验收标准：R00-AC12、R00-AC13
- [ ] 7. 前端公共错误处理
  - 说明：新建 `apps/web/src/lib/app-error.ts`（`appCode` → 中文提示、重置时间格式化）；`apps/web/src/utils/trpc.ts` 全局 toast 支持 `meta.skipGlobalErrorToast`
  - 对应验收标准：R00-AC11
- [ ] 8. 编写测试
  - [ ] 8.1 `client.test.ts`（模拟 `fetch`）：请求头齐全、有/无 token 时 `Authorization` 的有无、搜索 URL 带 `type:user`/`per_page=10`/`page`；搜索和资料查询各自的成功、404、403+remaining=0（搜索得到 `GITHUB_SEARCH_RATE_LIMITED`、资料得到 `GITHUB_RATE_LIMITED`，`resetAt` 正确）、429、422、5xx、超时（假的 `fetch` 抛 `TimeoutError`）、网络错误、返回字段缺失或类型不对
  - [ ] 8.2 缓存：同一关键字不同大小写第二次不发请求；61 秒后重新请求；第 501 条写入后最早的条目被淘汰；`getUserById` 和 `cache: false` 每次都发请求；错误响应不进缓存
  - [ ] 8.3 `schemas.test.ts`：用户名合法/非法边界（39/40 位、首尾 `-`、`--`、中文、空串）；关键字首尾空格、0/1/100/101 个字符
  - [ ] 8.4 `errors.test.ts`：通过 `createCaller` 或 `t.createCallerFactory` 调用一个抛 `appError` 的测试 procedure，断言格式化后的 `data.appCode`、`data.resetAt`；普通错误 `appCode` 为 `null`
  - 对应验收标准：R00-AC2 ~ R00-AC11
- [ ] 9. 自测并对照 requirements.md 逐条验收
  - 说明：`pnpm run test`、`pnpm run check`、`pnpm run check-types` 全部通过；检查迁移 SQL 与模型一致；`grep` 确认 web 代码里没有 `GITHUB_TOKEN`
  - 对应验收标准：R00-AC1 ~ R00-AC14

- CR（2026-11-10）：Codex 提出 0 条，采纳 0 条；不采纳：无
- CR（2026-11-10）：Codex 提出 0 条，采纳 0 条；不采纳：无（Codex 未发现可操作问题；其注明的数据库集成测试未运行属审查说明，非问题，交 W6R 回归测试覆盖）
