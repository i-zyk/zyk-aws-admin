# R09 删除（物理删除） - 任务清单

> 完成一项后把 `- [ ]` 改为 `- [✅]`

- [✅] 1. 后端 `githubUser.delete`
  - 说明：`delete where id`，`P2025` 转 `NOT_FOUND`/`RECORD_NOT_FOUND`，返回 `{ id }`
  - 对应验收标准：R09-AC2、R09-AC4、R09-AC5
  - 测试：pnpm -F @zyk-aws-admin/api run test（14 文件 322 项，使用测试数据库）+ pnpm run check-types（7 包）+ pnpm exec ultracite check（本批 15 个改动/新增的 ts/tsx 文件，0 问题），其中 github-user.delete.test.ts 13 项，通过（第 1 轮）
- [✅] 2. 删除确认框
  - 说明：`npx shadcn@latest add alert-dialog -c packages/ui`；新建 `delete-github-user-dialog.tsx`（显示用户名和不可恢复提示、取消不发请求、进行中禁用、成功和 `RECORD_NOT_FOUND` 的提示与查询失效、详情页删除后跳回列表、当前页删空时页码减 1）
  - 对应验收标准：R09-AC1 ~ R09-AC4、R09-AC6
  - 测试：pnpm -F @zyk-aws-admin/api run test（14 文件 322 项，使用测试数据库）+ pnpm run check-types（7 包）+ pnpm exec ultracite check（本批 15 个改动/新增的 ts/tsx 文件，0 问题） + agent-browser 登录后实测（主工作区 server:3000 + web:3001，临时账号 w6tester）：确认框标题「删除 defunkt？」并提示「删除后无法恢复，备注和标签会一起删除」；点「取消」后对话框关闭且没有 delete 请求；确认删除 toast「已删除」并重新请求 list/tags；详情页删除后跳回 /github-users，旧链接显示「记录不存在」；确认框打开后在页面外先删掉该记录，再点删除得到 404，提示「记录不存在」并刷新列表、该行消失；临时加 4 人凑到 11 条，每页 10 条升序打开第 2 页，删掉唯一一条后回到第 1 页（共 10 条，第 1 / 1 页）；控制台没有错误，通过（第 1 轮）
- [✅] 3. 接入详情页和列表
  - 说明：详情页和列表操作列加「删除」按钮
  - 对应验收标准：R09-AC1、R09-AC2
  - 测试：pnpm -F @zyk-aws-admin/api run test（14 文件 322 项，使用测试数据库）+ pnpm run check-types（7 包）+ pnpm exec ultracite check（本批 15 个改动/新增的 ts/tsx 文件，0 问题） + agent-browser 登录后实测（主工作区 server:3000 + web:3001，临时账号 w6tester）：详情页和列表每行操作列都有「删除」（无障碍名「删除 ：<用户名>」），两处删除都生效，通过（第 1 轮）
- [✅] 4. 编写测试（`github-user.delete.test.ts`，测试库 + 模拟的 `GithubClient`）
  - 说明：未登录 `UNAUTHORIZED`；删除后 `findUnique` 为 `null`、返回 `{ id }`；再删一次返回 `NOT_FOUND`/`RECORD_NOT_FOUND`；删除后用 `githubUser.create` 重新添加同一 `githubId` 成功（新记录 `id` 不同、`remark` 为空、`tags` 为 `[]`）；非正整数 ID 返回 `BAD_REQUEST`
  - 对应验收标准：R09-AC2、R09-AC4、R09-AC5
  - 测试：pnpm -F @zyk-aws-admin/api run test（github-user.delete.test.ts 13 项，测试库 + 模拟 GithubClient：未登录 UNAUTHORIZED、删除后 findUnique 为 null 且返回 { id }、再删返回 NOT_FOUND/RECORD_NOT_FOUND、删除后用 create 重新添加同一 githubId 成功且 id 不同、remark 为空、tags 为 []、非正整数 ID 返回 BAD_REQUEST）+ pnpm exec ultracite check（本批文件），通过（第 1 轮）
- [✅] 5. 自测并对照 requirements.md 逐条验收
  - 说明：浏览器中从列表和详情页删除；点取消时 Network 无请求；在两个标签页先后删除同一条看到「记录不存在」并刷新；删除后重新搜索添加同一人；`pnpm run check`、`pnpm run check-types` 通过
  - 对应验收标准：R09-AC1 ~ R09-AC6
  - 测试：pnpm -F @zyk-aws-admin/api run test（14 文件 322 项，使用测试数据库）+ pnpm run check-types（7 包）+ pnpm exec ultracite check（本批 15 个改动/新增的 ts/tsx 文件，0 问题） + agent-browser 登录后实测（主工作区 server:3000 + web:3001，临时账号 w6tester）：从列表和详情页删除都生效，取消时没有请求；两个标签页的场景里，另一个标签页回到前台时会自动重新查询，那一行（连同挂在行里的确认框）直接消失，所以改成确认框打开时在页面外删掉记录再点删除，看到「记录不存在」并刷新；defunkt 删除后重新搜索添加成功，id 从 3 变为新值，备注为「—」、无标签；测试用的 ry/tj/sindresorhus/gaearon 已从列表删除，名单恢复为 7 条（defunkt 现在的 id 是 85）；全仓 `pnpm run check` 的 50 个历史错误都在本需求未改动的文件里（native、fumadocs、ui/utils、server/env），本需求改动的文件 0 问题，通过（第 1 轮）
- CR（2026-11-12）：Codex 提出 1 条，采纳 1 条（该条针对 R07 编辑弹窗，已在 R07 修复，本需求无相关问题）；不采纳：无
- 验收（2026-11-12，W7b）：R09-AC1～AC6 全部满足。证据：vitest github-user.delete.test.ts 13 项通过（「物理删除记录并返回 { id }，不请求 GitHub」「再删一次返回 NOT_FOUND / RECORD_NOT_FOUND」「删除后可以重新添加同一个 GitHub 用户，新记录 id 不同、备注和标签为空」）；确认框文案、取消不发请求、「已删除」、详情页删除后回列表、「记录不存在」后刷新列表见任务 2、5 的浏览器记录；W7b 补测 AC6（临时账号 w7b-accept@example.com，web:3001）：在页面里把 githubUser.delete 请求挂起 4 秒后以网络错误结束（不真正删除），点确认后「删除」变为「正在删除…」且 disabled、「取消」也 disabled，再点被拒绝，期间只发出 1 次删除请求；失败后按钮恢复、记录仍在，刷新后名单仍为 7 条
