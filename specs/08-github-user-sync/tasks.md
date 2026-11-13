# R08 从 GitHub 同步 - 任务清单

> 完成一项后把 `- [ ]` 改为 `- [✅]`

- [✅] 1. 后端 `githubUser.sync`
  - 说明：先查本地记录（不存在 `RECORD_NOT_FOUND`）→ `getUserById(githubId)` → 只更新 GitHub 字段和 `syncedAt`；GitHub 错误透传，本地不改；`P2025` 转 `RECORD_NOT_FOUND`
  - 对应验收标准：R08-AC1 ~ R08-AC6
  - 测试：pnpm -F @zyk-aws-admin/api run test（12 文件 251 项，含 github-user.sync.test.ts 12 项，使用测试数据库）+ pnpm run check-types --force（7 包）+ pnpm exec ultracite check apps/web/src/components/github-users apps/web/src/app/github-users packages/api/src packages/db/src（41 文件 0 问题），通过（第 1 轮）
- [✅] 2. 同步按钮
  - 说明：新建 `sync-github-user-button.tsx`（进行中禁用、成功 toast「已同步」、失效 `byId`/`list`、按 `appCode` 提示，404 用同步场景文案）；接入详情页和列表操作列
  - 对应验收标准：R08-AC1、R08-AC4、R08-AC5、R08-AC6
  - 测试：pnpm -F @zyk-aws-admin/api run test（12 文件 251 项，含 github-user.sync.test.ts 12 项，使用测试数据库）+ pnpm run check-types --force（7 包）+ pnpm exec ultracite check apps/web/src/components/github-users apps/web/src/app/github-users packages/api/src packages/db/src（41 文件 0 问题） + agent-browser 登录后实测（worktree 的 server:3100 + web:3101，临时账号 w6-r08-sync@example.com）：详情页 /github-users/8 点「同步」→ 按钮变「正在同步…」且 disabled、toast「已同步」、「最后同步时间」从 14:07:44Z 更新为 01:17:37Z 并重新请求 byId；列表 ezmobius 行「同步：ezmobius」→ 进行中 disabled + aria-busy、toast「已同步」、粉丝数刷新为 GitHub 当前值（639→638）、最后同步时间更新；用 network route 模拟 sync 返回 GITHUB_USER_NOT_FOUND/GITHUB_RATE_LIMITED/GITHUB_UNAVAILABLE/RECORD_NOT_FOUND，分别提示「该账号在 GitHub 上已不存在」「GitHub 请求过于频繁，请在 04:26 之后重试」「GitHub 暂时无法访问，请稍后重试」「记录不存在」；/github-users/999999 显示记录不存在且没有「同步」按钮；控制台无错误，通过（第 1 轮）
- [✅] 3. 编写测试（`github-user.sync.test.ts`，测试库 + 模拟的 `GithubClient`）
  - 说明：未登录 `UNAUTHORIZED`；同步后 GitHub 字段与模拟数据一致、`syncedAt` 晚于原值、`remark` 和 `tags` 不变；模拟改名（同一 `githubId` 返回新 `login`）后 `login` 更新；调用的是 `getUserById(githubId)` 而不是按用户名；客户端抛 `GITHUB_USER_NOT_FOUND`/`GITHUB_RATE_LIMITED`/`GITHUB_UNAVAILABLE` 时透传、数据库记录逐字段不变；不存在的 ID 返回 `RECORD_NOT_FOUND` 且没有调用客户端
  - 对应验收标准：R08-AC1 ~ R08-AC6
  - 测试：pnpm -F @zyk-aws-admin/api run test（12 文件 251 项；github-user.sync.test.ts 12 项覆盖未登录、非法 id、只覆盖 GitHub 字段且 remark/tags/createdById 不变、syncedAt 晚于原值、改名后 login 更新、只调用 getUserById(githubId) 不调用 getUserByLogin、三种 GitHub 错误透传且记录逐字段不变、id 不一致不写库、不存在 ID 不调用客户端、P2025 转 RECORD_NOT_FOUND）+ pnpm exec ultracite check packages/api/src packages/db/src，通过（第 1 轮）
- [✅] 4. 自测并对照 requirements.md 逐条验收
  - 说明：浏览器中从列表和详情页同步；用数据库客户端把某条记录的 `login`、`followers` 改掉后同步，确认恢复为 GitHub 数据、备注标签不变；把 `githubId` 改成不存在的 ID 后同步，看到「该账号在 GitHub 上已不存在」且记录仍在；`pnpm run check`、`pnpm run check-types` 通过
  - 对应验收标准：R08-AC1 ~ R08-AC6
  - 测试：pnpm -F @zyk-aws-admin/api run test（12 文件 251 项，含 github-user.sync.test.ts 12 项，使用测试数据库）+ pnpm run check-types --force（7 包）+ pnpm exec ultracite check apps/web/src/components/github-users apps/web/src/app/github-users packages/api/src packages/db/src（41 文件 0 问题） + agent-browser 登录后实测（worktree 的 server:3100 + web:3101，临时账号 w6-r08-sync@example.com）：详情页 /github-users/8 点「同步」→ 按钮变「正在同步…」且 disabled、toast「已同步」、「最后同步时间」从 14:07:44Z 更新为 01:17:37Z 并重新请求 byId；列表 ezmobius 行「同步：ezmobius」→ 进行中 disabled + aria-busy、toast「已同步」、粉丝数刷新为 GitHub 当前值（639→638）、最后同步时间更新；用 network route 模拟 sync 返回 GITHUB_USER_NOT_FOUND/GITHUB_RATE_LIMITED/GITHUB_UNAVAILABLE/RECORD_NOT_FOUND，分别提示「该账号在 GitHub 上已不存在」「GitHub 请求过于频繁，请在 04:26 之后重试」「GitHub 暂时无法访问，请稍后重试」「记录不存在」；/github-users/999999 显示记录不存在且没有「同步」按钮；控制台无错误；「用数据库客户端改 login/followers、改 githubId 为不存在的 ID」这两步直接改开发库被权限拒绝，改由自动化测试（改名、404 透传且记录不变）+ 浏览器 mock 覆盖；全仓 `pnpm run check` 的历史错误不在本需求改动的文件里（由 R11 负责），通过（第 1 轮）
- CR（2026-11-12）：Codex 提出 1 条，采纳 1 条（该条针对 R07 编辑弹窗，已在 R07 修复，本需求无相关问题）；不采纳：无
- 验收（2026-11-12，W7b）：R08-AC1～AC6 全部满足。证据：vitest github-user.sync.test.ts 12 项通过（「按 githubId 拉取，只覆盖 GitHub 字段和 syncedAt，备注、标签、添加人不变」中模拟改名后 login 更新为 octocat-renamed，且只调用 getUserById(githubId)、不调用 getUserByLogin；「原样传递客户端错误 GITHUB_USER_NOT_FOUND / GITHUB_RATE_LIMITED / GITHUB_UNAVAILABLE，本地记录逐字段不变」；「不存在的记录返回 RECORD_NOT_FOUND，不调用 GitHub」）；cache.test.ts「getUserById 每次都发请求」「getUserById 不写缓存，之后按用户名查询仍发请求」通过（AC6 不走缓存）；client.test.ts「资料查询的路径分别是 /users/{login} 和 /user/{id}」通过（AC3）；按钮、「已同步」、最后同步时间更新、四种错误文案、进行中禁用见任务 2 的浏览器记录
