# R04 加入数据库 - 任务清单

> 完成一项后把 `- [ ]` 改为 `- [✅]`

- [✅] 1. 后端 `githubUser.create`
  - 说明：校验 → `getUserByLogin(username, { cache: false })` → 按 `githubId` 判重 → 写库（`createdById`、`syncedAt`）→ 捕获 `P2002` 转 `CONFLICT`；必要时在 `packages/db/src/index.ts` 导出 Prisma 错误判断函数
  - 对应验收标准：R04-AC2、R04-AC3、R04-AC4、R04-AC5、R04-AC6、R04-AC7
  - 测试：pnpm -F @zyk-aws-admin/api run test（9 文件 174 项）+ pnpm -F @zyk-aws-admin/api -F @zyk-aws-admin/db run check-types + pnpm exec ultracite check packages/api/src packages/db/src/index.ts，通过（第 1 轮）
- [✅] 2. 前端「加入数据库」
  - 说明：`github-preview.tsx` 中按钮调用 `create`，提交中禁用；成功 toast「已添加」并让 `lookup`/`search`/`list`/`tags` 失效；失败按 `appCode` 提示，`CONFLICT` 时也让 `lookup` 失效
  - 对应验收标准：R04-AC1、R04-AC2、R04-AC6、R04-AC7
  - 测试：pnpm -F web run check-types + pnpm exec ultracite check apps/web/src/app/github-users apps/web/src/components/github-users apps/web/src/lib/app-error.ts + pnpm -F @zyk-aws-admin/api run test（9 文件 174 项）+ agent-browser 实际页面验证（octocat 加入后 toast「已添加」、卡片切换为「已在名单中」；提交中按钮显示「正在加入…」并禁用；已在名单中时 toast「该用户已在名单中」并刷新 lookup），通过（第 1 轮）
- [✅] 3. 编写测试（`github-user.create.test.ts`，测试库 + 模拟的 `GithubClient`）
  - 说明：未登录 `UNAUTHORIZED`；非法用户名 `BAD_REQUEST`；成功后数据库中各字段与模拟的 GitHub 资料一致、`createdById` 为会话用户、`syncedAt` 为当前时间、`remark` 为空、`tags` 为 `[]`；调用客户端时 `cache: false`；先 `torvalds` 再 `Torvalds`（同一 `githubId`）第二次返回 `CONFLICT`；`Promise.allSettled` 并发两次只有一条成功、另一条 `CONFLICT`、表中只有一行；客户端抛 `GITHUB_USER_NOT_FOUND`/`GITHUB_RATE_LIMITED`/`GITHUB_UNAVAILABLE` 时透传且不写库
  - 对应验收标准：R04-AC2 ~ R04-AC7
  - 测试：pnpm -F @zyk-aws-admin/api run test（9 文件 174 项，其中 github-user.create.test.ts 15 项）+ pnpm -F @zyk-aws-admin/api -F @zyk-aws-admin/db run check-types + pnpm exec ultracite check packages/api/src packages/db/src/index.ts，通过（第 1 轮）
- [✅] 4. 自测并对照 requirements.md 逐条验收
  - 说明：浏览器中预览 `torvalds` → 加入 → 看到「已添加」和卡片状态变化；再次访问 `?username=Torvalds` 显示「已在名单中」；用数据库客户端或 Prisma Studio 核对保存的字段；`pnpm run check`、`pnpm run check-types` 通过（列表展示在 R05 验收）
  - 对应验收标准：R04-AC1 ~ R04-AC7
  - 测试：pnpm -F @zyk-aws-admin/api run test（9 文件 174 项）+ pnpm run check-types --force（7 包全部通过，无缓存）+ pnpm exec ultracite check apps/web/src/app/github-users apps/web/src/components/github-users apps/web/src/lib/app-error.ts packages/api/src packages/db/src/index.ts（30 文件无问题）+ 开发库核对 github_user 表 torvalds 行（githubId 1024025、remark 为空、tags 为 {}、createdById 非空、syncedAt 已写入），通过（第 1 轮）
- CR（2026-11-11）：Codex 提出 0 条，采纳 0 条；不采纳：无（Codex 未发现可操作问题，变更文件 lint 与 web/api/db 类型检查通过；其注明的数据库集成测试因环境只读未运行属审查说明，非问题，交 W6R 回归测试覆盖）
