# R10 批量删除（P1） - 任务清单

> 完成一项后把 `- [ ]` 改为 `- [✅]`

- [ ] 1. 后端 `githubUser.deleteMany`
  - 说明：`ids` 1～100 个正整数，去重后 `deleteMany`，返回 `{ count }`
  - 对应验收标准：R10-AC1、R10-AC4
- [ ] 2. 列表勾选和批量删除
  - 说明：`github-user-list.tsx` 加勾选列和「全选本页」（含半选、`aria-label`）；「批量删除（N）」按钮；新建 `bulk-delete-dialog.tsx`（显示数量和不可恢复提示，取消不发请求，进行中禁用）；成功提示「已删除 N 条」、清空勾选、失效查询、页码处理；URL 参数变化时清空勾选
  - 对应验收标准：R10-AC1、R10-AC2、R10-AC3、R10-AC5
- [ ] 3. 编写测试（`github-user.delete-many.test.ts`，测试库）
  - 说明：未登录 `UNAUTHORIZED`；删除 3 条后返回 `{ count: 3 }` 且数据库中不存在；混入 1 个不存在的 ID 时 `count` 为实际数量；重复 ID 只算一次；空数组、101 个 ID、非正整数返回 `BAD_REQUEST`；未勾选的记录不受影响
  - 对应验收标准：R10-AC1、R10-AC4
- [ ] 4. 自测并对照 requirements.md 逐条验收
  - 说明：浏览器中勾选若干条批量删除；全选本页后删除；取消时 Network 无请求；翻页后勾选清空；`pnpm run check`、`pnpm run check-types` 通过
  - 对应验收标准：R10-AC1 ~ R10-AC5
