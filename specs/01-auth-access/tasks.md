# R01 注册与登录（开放注册 + 限流 + 登录跳转） - 任务清单

> 完成一项后把 `- [ ]` 改为 `- [✅]`

- [✅] 1. 开启注册和登录限流
  - 说明：`packages/auth/src/index.ts` 加 `rateLimit`（`enabled: true`，`/sign-up/email`、`/sign-in/email` 各 60 秒 5 次）
  - 对应验收标准：R01-AC3
  - 测试：`pnpm -F @zyk-aws-admin/auth run check-types` + `pnpm exec ultracite check packages/auth/src/index.ts` + `pnpm -F @zyk-aws-admin/api run test`（121 项）+ `pnpm -F @zyk-aws-admin/api -F server run check-types`，通过（第 1 轮）
- [✅] 2. 注册、登录表单
  - 说明：`sign-up-form.tsx`、`sign-in-form.tsx` 成功后跳 `/github-users`；429 提示「操作过于频繁，请稍后再试」；重复邮箱提示「该邮箱已注册」；保留密码 8 位和邮箱格式校验；文案改中文
  - 对应验收标准：R01-AC1、R01-AC2、R01-AC3、R01-AC7、R01-AC9
  - 测试：`pnpm -F web run check-types` + `pnpm exec ultracite check`（本批 4 个文件，无新增问题；两个表单的 9 处 `noJsxPropsBind` 与 HEAD 相同，属脚手架原有）+ `getAuthErrorMessage` 6 个用例脚本 + 启动 server/web 用 agent-browser 实测（中文校验提示；注册成功自动登录跳 `/github-users`；重复邮箱提示「该邮箱已注册」；第 6 次注册 429 提示「操作过于频繁，请稍后再试」；登录错误密码显示原消息、正确密码跳 `/github-users`，登录与注册分开计数），通过（第 1 轮）
- [✅] 3. 后台页面保护和跳转
  - 说明：新建 `apps/web/src/app/github-users/layout.tsx`（无会话跳 `/login`）；占位 `page.tsx` 已在任务 2 创建（typedRoutes 需要）；`/`、`/dashboard` 改为跳转 `/github-users`；删除 `dashboard/dashboard.tsx`
  - 对应验收标准：R01-AC4、R01-AC7
  - 测试：`pnpm -F web run check-types` + `pnpm exec ultracite check`（本批 4 个文件：`github-users/layout.tsx`、`github-users/page.tsx`、`app/page.tsx`、`dashboard/page.tsx`，无问题）+ 运行中的 server/web 用 curl 与 agent-browser 实测（未登录：`/`、`/dashboard` 307 到 `/github-users`，`/github-users` 307 到 `/login`，浏览器打开 `/dashboard` 最终落在 `/login`；注册后：`/github-users` 200 显示「GitHub 用户」占位页，`/`、`/dashboard` 跳到 `/github-users`；`dashboard.tsx` 已删除），通过（第 1 轮）
- [✅] 4. 导航和退出登录
  - 说明：`header.tsx` 导航「GitHub 用户」；`user-menu.tsx` 退出后 `push("/login")` + `refresh()`
  - 对应验收标准：R01-AC6、R01-AC8
  - 测试：`pnpm -F web run check-types` + `pnpm exec ultracite check apps/web/src/components/header.tsx apps/web/src/components/user-menu.tsx`（仅 `user-menu.tsx` 1 处 `noJsxPropsBind`，与 HEAD 相同，属脚手架原有，无新增问题）+ 运行中的 server/web 用 agent-browser 实测（未登录：导航只有「GitHub 用户」，右上为「登录」；注册后跳 `/github-users`，点导航「GitHub 用户」停留在 `/github-users`，用户菜单显示邮箱与「退出登录」；点退出后落在 `/login`、菜单回到「登录」，再访问 `/github-users` 被跳回 `/login`），通过（第 1 轮）
- [✅] 5. README 写明开放注册风险
  - 对应验收标准：R01-AC9
  - 测试：仅改 `README.md`（文档，无代码模块）；`grep` 确认 README 含 AC9 原文「开放注册：任何注册用户都能修改和删除全部数据并消耗共用的 GitHub 额度，本期用注册限流降低滥用」+ 对照 `packages/auth/src/index.ts` 核对限流描述（`/sign-up/email`、`/sign-in/email` 各 60 秒 5 次、`enabled: true` 开发环境生效、默认内存存储）一致 + `pnpm exec ultracite check README.md`（Biome 不检查 md，0 文件）+ `pnpm -F @zyk-aws-admin/auth run check-types`，通过（第 1 轮）
- [✅] 6. 编写测试
  - [✅] 6.1 `packages/auth/src/index.test.ts`（测试库 + `auth.handler(new Request(...))`）：注册成功返回会话 Cookie（自动登录）；同一邮箱再次注册返回 `USER_ALREADY_EXISTS` 类错误码；同一 IP 连续注册 5 次都不是 429、第 6 次是 429；登录同理且与注册分开计数；换一个 `x-forwarded-for` 的 IP 不受影响；退出登录后用原 Cookie 调 `getSession` 得到 `null`
    - 测试：`pnpm -F @zyk-aws-admin/auth run test`（7 项，独立测试库 `_auth_test`）+ `pnpm -F @zyk-aws-admin/api run test`（122 项，含 `getTestDatabaseUrl` 后缀用例）+ `pnpm run test`（turbo 并行跑 api、auth，2/2 成功，互不干扰）+ `pnpm -F @zyk-aws-admin/auth -F @zyk-aws-admin/db -F @zyk-aws-admin/api -F server run check-types` + `pnpm exec ultracite check`（本批 7 个文件：auth 的 `index.test.ts`、3 个 vitest 配置、`package.json`，`db/src/testing.ts`，`api/src/test-database.test.ts`，无问题），通过（第 1 轮）
  - [✅] 6.2 `packages/api/src/routers/protected.test.ts`：`session: null` 时，`githubUserRouter` 中每个 procedure 和现有 `privateData` 都抛 `UNAUTHORIZED`（遍历 `_def.procedures`，后续需求新增的接口自动纳入）
    - 测试：`pnpm -F @zyk-aws-admin/api run test`（6 个文件 124 项；`protected.test.ts` 2 项：`githubUser.*` 与 `privateData` 均挂在 `appRouter` 上、`privateData` 未登录抛 `UNAUTHORIZED`，`githubUserRouter` 当前为空，R02～R10 新增 procedure 会被 `it.each` 自动纳入）+ `pnpm -F @zyk-aws-admin/api run check-types` + `pnpm exec ultracite check packages/api`（20 个文件，无问题），通过（第 1 轮）
  - 对应验收标准：R01-AC1 ~ R01-AC6
- [✅] 7. 自测并对照 requirements.md 逐条验收
  - 说明：启动 `pnpm run dev:server` 和 `pnpm run dev:web`，在浏览器里验证注册自动登录并跳转、重复邮箱提示、第 6 次注册的限流提示、未登录访问三个后台路径都跳 `/login`、`/` 和 `/dashboard` 跳转、退出后回到 `/login`；`pnpm run check`、`pnpm run check-types` 通过
  - 对应验收标准：R01-AC1 ~ R01-AC9

  - 验收补充：为 `/github-users/new`、`/github-users/[id]` 提前创建占位页，修复不存在的子路由绕过布局直接 404 的验收缺口；后续 R02、R06 替换。
  - 测试：`pnpm run db:generate`、`pnpm run test`（api 124 + auth 7）、`pnpm run check-types` 通过；`pnpm exec ultracite check` 本提交点 20 个文件，除两个表单和用户菜单原有的 10 处 `noJsxPropsBind` 外无问题（与 HEAD 对比一致，按 R00 决策 D3 留给 R11）；`pnpm exec ultracite check apps/web/src/app/github-users` 4 个文件通过；agent-browser 实测注册自动登录、重复邮箱中文提示、注册 429 中文提示、正确登录、登录后 `/`/`/dashboard` 跳名单、退出、未登录访问名单/添加/详情均跳 `/login`；Next MCP 编译无错误，通过（第 2 轮：首轮发现两个未建子路由直接 404，已补占位页）。

- [✅] 8. 修复 CR 发现的客户端导航会话复查缺口
  - 复现：已登录打开 `/github-users/new`；直接调用退出接口模拟会话在别处失效，`get-session` 已返回 `null`；点击顶部「GitHub 用户」后仍进入 `/github-users` 并显示名单占位内容，没有跳转 `/login`。
  - 计划：抽取服务端 `requireSession()`；在名单、添加、详情各自的 page 中执行会话检查，布局复用同一函数；后续页面继续保留检查。验收覆盖会话失效后的客户端导航、首次访问、注册登录和退出。
  - 确认：2026-11-11 用户同意修复，design.md 已同步页面级检查和请求内去重。
  - 测试：`pnpm exec ultracite fix/check apps/web/src/lib/require-session.ts apps/web/src/app/github-users`（5 文件、0 问题）；`pnpm run db:generate`、`pnpm run test`（api 124 + auth 7）和 `pnpm run check-types`（7 个任务）通过；agent-browser 登录后使服务端会话失效，分别客户端导航到名单、添加、详情，最终均为 `/login`；未登录首次访问三个后台页、`/`、`/dashboard` 均到 `/login`；Next MCP 编译问题和运行时错误为空，通过（回归第 1 轮）。

- CR（2026-11-10）：Codex 提出 1 条，采纳 1 条（P2：共享布局在客户端导航时不重跑会话校验）；浏览器已复现，2026-11-11 用户同意后完成修复与回归；按流程不复审。

- 提交点回归（2026-11-11，第 1 轮）：131 项自动化测试与全仓类型检查通过；本提交点 21 个 TS/TSX/JSON 文件 lint 仅余 10 处与 HEAD 一致的 `noJsxPropsBind`（R11 遗留范围），无新增问题；CR 修复的 5 个文件 lint 全通过。
