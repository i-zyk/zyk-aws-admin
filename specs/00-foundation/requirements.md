# R00 基础设施：数据模型、GitHub 客户端、错误码、测试框架

> 来源：docs/需求.md 第 5 节「数据模型」、第 6.1～6.3 节「技术方案」、第 8 节「非功能需求」、第 10 节「里程碑」M1

## 背景与目标

REQ-01～REQ-10 都依赖同一套底座：`GithubUser` 表、调用 GitHub REST API 的客户端（请求头、超时、错误映射、缓存）、前后端共用的校验规则、带业务错误码的 tRPC 错误格式，以及 Vitest 测试框架。先把这些做好，后面的需求只写业务逻辑。

## 用户故事

- 作为开发者，我希望 GitHub 调用、错误码、校验规则和测试环境只做一次，以便后续每个需求只关注自己的业务逻辑。
- 作为管理员，我希望 GitHub 出问题时看到明确的中文提示，而不是一串英文报错。

## 验收标准

- [✅] R00-AC1：`packages/db/prisma/schema/github-user.prisma` 中的 `GithubUser` 模型与 PRD 第 5 节一致（字段、默认值、`githubId` 唯一、`login`/`tags`(GIN)/`createdAt` 索引、`@@map("github_user")`，没有 `deletedAt`），`auth.prisma` 没有改动；迁移文件在新建的独立开发库 `zyk_aws_admin` 上由 `pnpm run db:migrate` 生成（第一个迁移同时包含 auth 表和 `github_user` 表），提交在 `packages/db/prisma/migrations/` 下；旧库 `postgres` 没有任何写操作。
- [✅] R00-AC2：仓库引入 Vitest，在根目录执行 `pnpm run test` 能运行所有包的测试；需要数据库的测试使用同一 PostgreSQL 实例上的独立测试库 `zyk_aws_admin_test`，不读写开发库的数据。
- [✅] R00-AC3：GitHub 客户端每个请求都带 `Accept: application/vnd.github+json`、`X-GitHub-Api-Version: 2022-11-28`、`User-Agent: zyk-aws-admin`；配置了 token 时带 `Authorization: Bearer <token>`，没配置时不带。
- [✅] R00-AC4：GitHub 请求超过 10 秒、网络错误或返回 5xx 时，抛出 `BAD_GATEWAY`，`appCode` 为 `GITHUB_UNAVAILABLE`。
- [✅] R00-AC5：GitHub 返回 404 时，抛出 `NOT_FOUND`，`appCode` 为 `GITHUB_USER_NOT_FOUND`。
- [✅] R00-AC6：GitHub 返回 403 或 429 且 `x-ratelimit-remaining` 为 0 时，抛出 `TOO_MANY_REQUESTS`；搜索接口的 `appCode` 为 `GITHUB_SEARCH_RATE_LIMITED`，其他接口为 `GITHUB_RATE_LIMITED`；两者都带 `resetAt`（取自 `x-ratelimit-reset`）。
- [✅] R00-AC7：搜索接口返回 422 时，抛出 `BAD_REQUEST`，`appCode` 为 `GITHUB_SEARCH_INVALID`。
- [✅] R00-AC8：GitHub 返回的数据先经 Zod 校验，格式不符时按 GitHub 不可用处理（`BAD_GATEWAY` / `GITHUB_UNAVAILABLE`），不把异常数据传给调用方。
- [✅] R00-AC9：搜索结果按「关键字小写 + 页码」、资料查询结果按「用户名小写」在内存中缓存 60 秒；缓存最多 500 条，超出时淘汰最早的；按 ID 查询（同步用）和显式要求跳过缓存的调用（添加用）不读也不写缓存。
- [✅] R00-AC10：`packages/api/src/github/schemas.ts` 提供用户名校验规则（1～39 个字符，只含字母、数字和 `-`，不以 `-` 开头或结尾，没有连续两个 `-`）和搜索关键字校验规则（去掉首尾空格后 1～100 个字符），前端表单和 tRPC 接口共用。该文件只依赖 `zod`，不导入 db、auth、tRPC 等服务端代码；`apps/web` 只允许从 `packages/api` 运行时导入这一个文件。
- [✅] R00-AC11：tRPC 错误响应的 `error.data` 中带 `appCode`（没有业务错误码时为 `null`），限流错误还带 `resetAt`；前端有统一的 `appCode` → 中文提示映射。
- [✅] R00-AC12：tRPC 上下文包含 `github: GithubClient`，由 `apps/server/src/services.ts` 根据可选的 `ENV.GITHUB_TOKEN` 创建单例；`GITHUB_TOKEN` 在 `apps/server/.env.schema` 中声明为可选、敏感，并加进 `turbo.json` 的 `globalEnv`；token 不出现在任何前端代码或响应中。
- [✅] R00-AC13：`githubUserRouter` 已创建并以 `githubUser` 合并进 `appRouter`。
- [✅] R00-AC14：`pnpm run check-types` 通过；`pnpm run check`（`ultracite check`）对 R00 改动过的文件（相对基线 `907bf5b` 新增或修改的代码和配置文件）0 问题。全仓 `pnpm run check` 0 错误不在本需求验收，移到 R11（见「已确认决策」D3）。

## 不在范围内

- 具体业务接口（search、lookup、create 等）在 R02～R10 中实现
- 生产部署、多实例下的缓存共享

## 依赖

- 无

## 已确认决策

- **D1 开发数据库（用户已确认，选方案 A）**：原 `apps/server/.env` 的 `DATABASE_URL` 指向的库 `postgres` 里有另一个项目的迁移历史（`20261107012924_init`、`20261108034346_add_person`）和 `person` 表，直接 `db:migrate` 会触发重置。处理方式：
  - 在同一个 PostgreSQL 实例上新建独立数据库 `zyk_aws_admin`，用户已授权工作流建库。
  - 把 `apps/server/.env` 里 `DATABASE_URL` 的库名改成 `zyk_aws_admin`，只改库名，主机、端口、账号、密码不变；`.env` 已被 gitignore，不提交。
  - 旧库 `postgres` 完全不动，不做任何写操作，也不重置；原有那 1 个账号之后在新库重新注册。
  - 测试库为同一实例上的 `zyk_aws_admin_test`。
- **D2 web 运行时导入共享校验规则（用户已同意）**：作为 AGENTS.md「web 只从 `api` 导入 `AppRouter` 类型」的唯一例外，`apps/web` 只允许运行时导入 `packages/api/src/github/schemas.ts` 这一个文件（`@zyk-aws-admin/api/github/schemas`），该文件只能依赖 `zod`。W8 文档同步时把这个例外写进 AGENTS.md。

- **D3 `pnpm run check` 检查范围（用户已确认，选方案 B）**：全仓 `pnpm run check` 有 55 个错误（另有 3 个警告、2 个提示），全部在 R00 没有改动的文件里，基线提交 `907bf5b` 就已存在（登录注册表单、首页、dashboard、native、`packages/ui`、`apps/fumadocs` 等脚手架代码，以及 `apps/fumadocs/biome.json` 的 schema 版本与根目录 Biome 不匹配），不属于 R00 的范围。处理方式：
  - R00-AC14 的 `pnpm run check` 只检查 R00 改动过的文件，命令：`(git diff --name-only 907bf5b HEAD; git ls-files --others --exclude-standard)` 中的代码和配置文件交给 `pnpm exec ultracite check <文件...>`，要求 0 问题。
  - 遗留问题由新增的 R11「清理遗留 lint」处理，排在所有功能之后、W8 交付之前；验收标准是全仓 `pnpm run check` 0 错误。
  - 不在根目录 `biome.json` 里整体排除目录或关闭规则。

## 待确认问题

- 无

## 验收记录（W7b，2026-11-10）

逐条证据（全部为命令或测试输出，不是读代码判断）：

- AC1：PRD 第 5 节模型代码块与 `github-user.prisma` 做 `diff`，完全一致；`git diff 907bf5b -- auth.prisma` 0 行；迁移只有 `20261110142224_init`，含 `user/session/account/verification/github_user` 五张表及 `github_user_githubId_key`（唯一）、`login`、`tags`（GIN）、`createdAt` 索引；开发库 `zyk_aws_admin` 上 `prisma migrate status` 为 up to date，`prisma migrate diff --exit-code` 输出 No difference detected；旧库 `postgres` 的 `_prisma_migrations` 仍只有 `20261107012924_init`、`20261108034346_add_person`，表仍是 `account,person,session,user,verification`，没有 `github_user`。
- AC2：根目录 `pnpm run test` → turbo `@zyk-aws-admin/api:test`，5 个文件 121 个用例通过；`test-database.test.ts` 的「测试进程的 DATABASE_URL 指向 _test 库」「createTestDatabase 拒绝连接非测试库」等 5 个用例通过；跑测试前后开发库 `github_user` 的 `n_tup_ins/upd/del` 均为 0，测试库 `n_tup_ins` 为 29。
- AC3：`client.test.ts`「每个请求都带 GitHub 要求的请求头，没配置 token 时不带 Authorization」「配置了 token 时带 Authorization: Bearer <token>」「token 为空字符串时不带 Authorization」通过。
- AC4：`client.test.ts` 三个接口各自的 500/502/503、「超时（fetch 抛 TimeoutError）」「网络错误（fetch 抛 TypeError）」→ BAD_GATEWAY / GITHUB_UNAVAILABLE 通过；另用临时用例让假 `fetch` 一直不响应，实测 10003ms 后抛 BAD_GATEWAY / GITHUB_UNAVAILABLE。
- AC5：`client.test.ts` 三个接口「404 → NOT_FOUND / GITHUB_USER_NOT_FOUND」通过。
- AC6：`client.test.ts` 搜索「403 且 x-ratelimit-remaining=0 → TOO_MANY_REQUESTS，resetAt 取自 x-ratelimit-reset」「429 → …」（GITHUB_SEARCH_RATE_LIMITED），getUserByLogin / getUserById 同名用例（GITHUB_RATE_LIMITED），以及「403 但额度没用完 → BAD_GATEWAY」通过。
- AC7：`client.test.ts`「搜索接口 422 → BAD_REQUEST / GITHUB_SEARCH_INVALID」通过（资料接口 422 → GITHUB_UNAVAILABLE）。
- AC8：`client.test.ts`「返回字段不符」7 个用例和「响应体不是 JSON」通过；`cache.test.ts`「错误响应（字段不符）不进缓存」通过。
- AC9：`cache.test.ts`「缓存配置为 60 秒、最多 500 条」「同一关键字不同大小写，第二次搜索不发请求」「同一关键字不同页码分别缓存」「同一用户名不同大小写…不发请求」「59 秒内命中缓存，61 秒后重新请求」「第 501 条写入后最早的条目被淘汰」「getUserById 每次都发请求」「getUserByLogin(…, { cache: false }) 每次都发请求，也不写缓存 / 不读已有缓存」等 20 个用例通过。
- AC10：`schemas.test.ts` 33 个用例（用户名 1/39/40 位、首尾 `-`、`--`、中文、空串；关键字 0/1/100/101 个字符、首尾空格）通过；`grep` 显示 `schemas.ts` 唯一的 import 是 `zod`；在 `apps/web` 下 `import.meta.resolve("@zyk-aws-admin/api/github/schemas")` 解析到 `packages/api/src/github/schemas.ts`；`apps/web/src` 中没有对 `@zyk-aws-admin/api` 的非 `import type` 导入。
- AC11：`errors.test.ts` 10 个用例（含「限流错误的响应 JSON 里带 appCode 和 resetAt」「普通错误的响应 JSON 里 appCode 为 null」）通过；另用临时用例调用 `apps/web/src/lib/app-error.ts`，7 个 appCode 都得到中文提示，限流提示带 HH:mm、搜索限流带 HH:mm:ss，无 appCode 时回退到 `error.message`。
- AC12：用 `tsx` 实际加载 `apps/server/src/context.ts`（`.env` 未配置 `GITHUB_TOKEN`，可正常启动）：上下文键为 `db,github,session`，`ctx.github` 与 `services.ts` 的 `github` 是同一实例，两次请求共用；`env.ts` 生成 `GITHUB_TOKEN?: string` 并标 sensitive，`.env.schema` 为 `@optional @sensitive`，`turbo.json` 的 `globalEnv` 含 `GITHUB_TOKEN`；`grep -rn GITHUB_TOKEN apps/web apps/native` 无结果；临时用例让带 token 的客户端经 `fetchRequestHandler` 返回 403/404/429/422/500，HTTP 响应体都不含 token。
- AC13：临时用例中 `appRouter._def.record` 的键为 `githubUser,healthCheck,privateData`，`githubUser` 即 `githubUserRouter`。
- AC14：`pnpm run check-types` 7 个任务通过；相对 `907bf5b` 改动和新增的 27 个代码和配置文件 `pnpm exec ultracite check` → Checked 27 files，0 问题。
