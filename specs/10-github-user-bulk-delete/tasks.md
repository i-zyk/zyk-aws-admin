# R10 批量删除（P1） - 任务清单

> 完成一项后把 `- [ ]` 改为 `- [✅]`

- [✅] 1. 后端 `githubUser.deleteMany`
  - 说明：`ids` 1～100 个正整数，去重后 `deleteMany`，返回 `{ count }`
  - 对应验收标准：R10-AC1、R10-AC4
  - 测试：pnpm -F @zyk-aws-admin/api run test（14 文件 323 项，使用测试数据库；deleteMany 的专项用例在任务 3 补）+ pnpm -F @zyk-aws-admin/api run check-types + pnpm -F web run check-types + pnpm exec biome check（本批 2 个改动文件 schemas.ts、github-user.ts，0 问题），通过（第 1 轮）
- [✅] 2. 列表勾选和批量删除
  - 说明：`github-user-list.tsx` 加勾选列和「全选本页」（含半选、`aria-label`）；「批量删除（N）」按钮；新建 `bulk-delete-dialog.tsx`（显示数量和不可恢复提示，取消不发请求，进行中禁用）；成功提示「已删除 N 条」、清空勾选、失效查询、页码处理；URL 参数变化时清空勾选
  - 对应验收标准：R10-AC1、R10-AC2、R10-AC3、R10-AC5
  - 测试：pnpm -F web run check-types + pnpm -F @zyk-aws-admin/ui run check-types + pnpm exec biome check（本批 3 个改动文件 github-user-list.tsx、bulk-delete-dialog.tsx、checkbox.tsx，0 问题）+ pnpm -F @zyk-aws-admin/api run test（14 文件 323 项；web / ui 无单元测试和 E2E 配置，浏览器交互验收在任务 4），通过（第 2 轮）
- [✅] 3. 编写测试（`github-user.delete-many.test.ts`，测试库）
  - 说明：未登录 `UNAUTHORIZED`；删除 3 条后返回 `{ count: 3 }` 且数据库中不存在；混入 1 个不存在的 ID 时 `count` 为实际数量；重复 ID 只算一次；空数组、101 个 ID、非正整数返回 `BAD_REQUEST`；未勾选的记录不受影响
  - 对应验收标准：R10-AC1、R10-AC4
  - 测试：pnpm -F @zyk-aws-admin/api run test（15 文件 338 项，使用测试数据库；其中 github-user.delete-many.test.ts 15 项）+ pnpm -F @zyk-aws-admin/api run check-types + pnpm exec biome check（本批新增文件 github-user.delete-many.test.ts，0 问题），通过（第 1 轮）
- [✅] 4. 自测并对照 requirements.md 逐条验收
  - 说明：浏览器中勾选若干条批量删除；全选本页后删除；取消时 Network 无请求；翻页后勾选清空；`pnpm run check`、`pnpm run check-types` 通过
  - 对应验收标准：R10-AC1 ~ R10-AC5
  - 测试：pnpm -F @zyk-aws-admin/api run test（15 文件 338 项，使用测试数据库）+ pnpm run check-types（7 包）+ pnpm exec biome check（本需求 6 个改动/新增的 ts/tsx 文件，0 问题）+ agent-browser 登录后实测（主工作区 server:3000 + web:3001，临时账号 w6-r10-bulk-1794479730@example.com，开发库临时插入 25 条 w6bulk-* 记录、每页 10 条）：无勾选时不显示批量按钮；勾 3 条后表头半选、显示「批量删除（3）」，确认框标题「删除选中的 3 条记录？」并有不可恢复提示，取消后 Network 无 deleteMany 请求；确认后提示「已删除 3 条」、3 条从列表和数据库消失、勾选清空；翻页再翻回、改关键字、切换排序方向都会清空勾选；第 1 页全选删除 10 条后停在第 1 页并补上后续记录，末页全选删除 2 条后退回第 1 页；勾 3 条后在库里先删掉其中 1 条再确认，提示「已删除 2 条」（取接口实际数量）；测试记录已全部删除，名单恢复为 7 条；全仓 `pnpm run check` 的 50 个历史错误都在本需求未改动的文件里（native、fumadocs、ui/utils、server/env 及未入库的 .workflow/state.json），本需求改动的文件 0 问题，通过（第 1 轮）
- CR（2026-11-12）：Codex 提出 2 条，采纳 2 条（[P1] 已在此前修复；[P2] 批量删除后页码按刷新后的 total 纠正，不再用 total - count 推算，选中记录已被别人先删除、count 偏小或为 0 时也会跳回最后一页，单条删除同样登记纠正，已修复 github-user-list.tsx 并经用户授权同步 design.md 方案与自测项）；不采纳：无
- 验收（W7b，2026-11-12）：R10-AC1～AC5 全部满足。证据：`varlock run --path ../db/ -- vitest run github-user.delete-many` 15 项全部通过（AC4：空数组 / 101 个 / 非法 ID 返回 BAD_REQUEST、不存在的 ID 忽略、返回实际 count）；CR 修复后重新用 agent-browser 实测（server:3000 + web:3001，临时账号和临时记录测试后已删除）：无勾选时无批量按钮，勾 3 条后表头半选、显示「批量删除（3）」，确认框「删除选中的 3 条记录？」+ 不可恢复提示，取消后 Network 无 deleteMany 请求；确认后提示「已删除 3 条」，列表和数据库中均消失，勾选清空；库里先删掉 1 条再确认提示「已删除 1 条」；全选本页删除 10 条提示「已删除 10 条」并停在第 1 页；翻页再翻回、改关键字、切换排序方向都清空勾选；末页全选 2 条（其中 1 条已被先删）后提示「已删除 1 条」并跳回第 1 页；控制台无错误
