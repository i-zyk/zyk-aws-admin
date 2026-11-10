# R08 从 GitHub 同步 - 任务清单

> 完成一项后把 `- [ ]` 改为 `- [✅]`

- [ ] 1. 后端 `githubUser.sync`
  - 说明：先查本地记录（不存在 `RECORD_NOT_FOUND`）→ `getUserById(githubId)` → 只更新 GitHub 字段和 `syncedAt`；GitHub 错误透传，本地不改；`P2025` 转 `RECORD_NOT_FOUND`
  - 对应验收标准：R08-AC1 ~ R08-AC6
- [ ] 2. 同步按钮
  - 说明：新建 `sync-github-user-button.tsx`（进行中禁用、成功 toast「已同步」、失效 `byId`/`list`、按 `appCode` 提示，404 用同步场景文案）；接入详情页和列表操作列
  - 对应验收标准：R08-AC1、R08-AC4、R08-AC5、R08-AC6
- [ ] 3. 编写测试（`github-user.sync.test.ts`，测试库 + 模拟的 `GithubClient`）
  - 说明：未登录 `UNAUTHORIZED`；同步后 GitHub 字段与模拟数据一致、`syncedAt` 晚于原值、`remark` 和 `tags` 不变；模拟改名（同一 `githubId` 返回新 `login`）后 `login` 更新；调用的是 `getUserById(githubId)` 而不是按用户名；客户端抛 `GITHUB_USER_NOT_FOUND`/`GITHUB_RATE_LIMITED`/`GITHUB_UNAVAILABLE` 时透传、数据库记录逐字段不变；不存在的 ID 返回 `RECORD_NOT_FOUND` 且没有调用客户端
  - 对应验收标准：R08-AC1 ~ R08-AC6
- [ ] 4. 自测并对照 requirements.md 逐条验收
  - 说明：浏览器中从列表和详情页同步；用数据库客户端把某条记录的 `login`、`followers` 改掉后同步，确认恢复为 GitHub 数据、备注标签不变；把 `githubId` 改成不存在的 ID 后同步，看到「该账号在 GitHub 上已不存在」且记录仍在；`pnpm run check`、`pnpm run check-types` 通过
  - 对应验收标准：R08-AC1 ~ R08-AC6
