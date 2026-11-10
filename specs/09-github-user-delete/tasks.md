# R09 删除（物理删除） - 任务清单

> 完成一项后把 `- [ ]` 改为 `- [✅]`

- [ ] 1. 后端 `githubUser.delete`
  - 说明：`delete where id`，`P2025` 转 `NOT_FOUND`/`RECORD_NOT_FOUND`，返回 `{ id }`
  - 对应验收标准：R09-AC2、R09-AC4、R09-AC5
- [ ] 2. 删除确认框
  - 说明：`npx shadcn@latest add alert-dialog -c packages/ui`；新建 `delete-github-user-dialog.tsx`（显示用户名和不可恢复提示、取消不发请求、进行中禁用、成功和 `RECORD_NOT_FOUND` 的提示与查询失效、详情页删除后跳回列表、当前页删空时页码减 1）
  - 对应验收标准：R09-AC1 ~ R09-AC4、R09-AC6
- [ ] 3. 接入详情页和列表
  - 说明：详情页和列表操作列加「删除」按钮
  - 对应验收标准：R09-AC1、R09-AC2
- [ ] 4. 编写测试（`github-user.delete.test.ts`，测试库 + 模拟的 `GithubClient`）
  - 说明：未登录 `UNAUTHORIZED`；删除后 `findUnique` 为 `null`、返回 `{ id }`；再删一次返回 `NOT_FOUND`/`RECORD_NOT_FOUND`；删除后用 `githubUser.create` 重新添加同一 `githubId` 成功（新记录 `id` 不同、`remark` 为空、`tags` 为 `[]`）；非正整数 ID 返回 `BAD_REQUEST`
  - 对应验收标准：R09-AC2、R09-AC4、R09-AC5
- [ ] 5. 自测并对照 requirements.md 逐条验收
  - 说明：浏览器中从列表和详情页删除；点取消时 Network 无请求；在两个标签页先后删除同一条看到「记录不存在」并刷新；删除后重新搜索添加同一人；`pnpm run check`、`pnpm run check-types` 通过
  - 对应验收标准：R09-AC1 ~ R09-AC6
