# R07 修改备注和标签 - 任务清单

> 完成一项后把 `- [ ]` 改为 `- [✅]`

- [ ] 1. 共享规则和后端 `githubUser.update`
  - 说明：`schemas.ts` 完善 `remarkSchema`、`tagsSchema`，新增 `.strict()` 的 `githubUserUpdateInputSchema`；`update` 只写 `remark`、`tags`，`P2025` 转 `NOT_FOUND`/`RECORD_NOT_FOUND`
  - 对应验收标准：R07-AC2、R07-AC3、R07-AC4、R07-AC6
- [ ] 2. 编辑表单和对话框
  - 说明：`npx shadcn@latest add dialog -c packages/ui`；新建 `edit-github-user-form.tsx`（备注 + 标签输入，共享规则校验，字数提示）和 `edit-github-user-dialog.tsx`；成功 toast「已保存」并失效 `byId`/`list`/`tags`；`RECORD_NOT_FOUND` 提示「记录不存在」
  - 对应验收标准：R07-AC1、R07-AC2、R07-AC4、R07-AC5、R07-AC6
- [ ] 3. 接入详情页和列表
  - 说明：详情页后台信息区块加「编辑」；列表操作列加「编辑」；GitHub 资料区域保持只读
  - 对应验收标准：R07-AC1、R07-AC5
- [ ] 4. 编写测试
  - [ ] 4.1 `schemas.test.ts` 补充：备注 500/501 字、首尾空格、空串转 `null`；标签 trim、去空、去重、去重后 10 个通过、11 个失败、单个 20/21 字
  - [ ] 4.2 `github-user.update.test.ts`（测试库）：未登录 `UNAUTHORIZED`；更新后再查数据仍在；只传 `tags` 时 `remark` 不变；`remark: null` 清空；带 `name`/`followers`/`login` 等字段返回 `BAD_REQUEST` 且数据库无变化；超限返回 `BAD_REQUEST`；不存在的 ID 返回 `NOT_FOUND`/`RECORD_NOT_FOUND`；GitHub 字段在更新前后完全一致
  - 对应验收标准：R07-AC1 ~ R07-AC4、R07-AC6
- [ ] 5. 自测并对照 requirements.md 逐条验收
  - 说明：浏览器中分别从详情页和列表行修改并刷新确认；输入超长备注、第 11 个标签、21 字标签看到前端提示；`pnpm run check`、`pnpm run check-types` 通过
  - 对应验收标准：R07-AC1 ~ R07-AC6
