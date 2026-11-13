# R07 修改备注和标签 - 任务清单

> 完成一项后把 `- [ ]` 改为 `- [✅]`

- [✅] 1. 共享规则和后端 `githubUser.update`
  - 说明：`schemas.ts` 完善 `remarkSchema`、`tagsSchema`，新增 `.strict()` 的 `githubUserUpdateInputSchema`；`update` 只写 `remark`、`tags`，`P2025` 转 `NOT_FOUND`/`RECORD_NOT_FOUND`
  - 对应验收标准：R07-AC2、R07-AC3、R07-AC4、R07-AC6
  - 测试：pnpm -F @zyk-aws-admin/api run test（14 文件 322 项，使用测试数据库）+ pnpm run check-types（7 包）+ pnpm exec ultracite check（本批 15 个改动/新增的 ts/tsx 文件，0 问题），其中 github-user.update.test.ts 31 项、schemas.test.ts 58 项，通过（第 1 轮）
- [✅] 2. 编辑表单和对话框
  - 说明：`npx shadcn@latest add dialog -c packages/ui`；新建 `edit-github-user-form.tsx`（备注 + 标签输入，共享规则校验，字数提示）和 `edit-github-user-dialog.tsx`；成功 toast「已保存」并失效 `byId`/`list`/`tags`；`RECORD_NOT_FOUND` 提示「记录不存在」
  - 对应验收标准：R07-AC1、R07-AC2、R07-AC4、R07-AC5、R07-AC6
  - 测试：pnpm -F @zyk-aws-admin/api run test（14 文件 322 项，使用测试数据库）+ pnpm run check-types（7 包）+ pnpm exec ultracite check（本批 15 个改动/新增的 ts/tsx 文件，0 问题） + agent-browser 登录后实测（主工作区 server:3000 + web:3001，临时账号 w6tester）：列表 ezmobius 行「编辑」打开对话框，备注「  W6 测试备注  」保存后显示为去掉首尾空格的「W6 测试备注」，标签输入「a,b，a, c 」回车拆成 a/b/c（去空、去重、全角逗号也能分隔，回车不提交表单），保存 toast「已保存」并重新请求 byId，刷新后数据仍在；501 字备注提示「备注最多 500 个字符」、21 字标签提示「每个标签最多 20 个字符」、第 11 个标签提示「标签最多 10 个」，此时点保存没有发出 update 请求，取消后数据不变；清空备注、删掉全部标签保存后显示「—」「无标签」；打开对话框后在页面外删掉记录再保存，提示「记录不存在」且详情页显示记录不存在；控制台只有头像 LCP 的提示，没有错误，通过（第 1 轮）
- [✅] 3. 接入详情页和列表
  - 说明：详情页后台信息区块加「编辑」；列表操作列加「编辑」；GitHub 资料区域保持只读
  - 对应验收标准：R07-AC1、R07-AC5
  - 测试：pnpm -F @zyk-aws-admin/api run test（14 文件 322 项，使用测试数据库）+ pnpm run check-types（7 包）+ pnpm exec ultracite check（本批 15 个改动/新增的 ts/tsx 文件，0 问题） + agent-browser 登录后实测（主工作区 server:3000 + web:3001，临时账号 w6tester）：详情页「后台信息」区块和列表操作列都有「编辑」，对话框写明「GitHub 资料只读，只能通过同步更新」，表单里只有备注和标签，GitHub 资料区域没有可编辑的地方，通过（第 1 轮）
- [✅] 4. 编写测试
  - [✅] 4.1 `schemas.test.ts` 补充：备注 500/501 字、首尾空格、空串转 `null`；标签 trim、去空、去重、去重后 10 个通过、11 个失败、单个 20/21 字
    - 测试：pnpm -F @zyk-aws-admin/api run test（schemas.test.ts 58 项：备注 500/501 字、首尾空格、空串转 null；标签 trim、去空、去重、去重后 10 个通过、11 个失败、单个 20/21 字）+ pnpm exec ultracite check（本批文件），通过（第 1 轮）
  - [✅] 4.2 `github-user.update.test.ts`（测试库）：未登录 `UNAUTHORIZED`；更新后再查数据仍在；只传 `tags` 时 `remark` 不变；`remark: null` 清空；带 `name`/`followers`/`login` 等字段返回 `BAD_REQUEST` 且数据库无变化；超限返回 `BAD_REQUEST`；不存在的 ID 返回 `NOT_FOUND`/`RECORD_NOT_FOUND`；GitHub 字段在更新前后完全一致
    - 测试：pnpm -F @zyk-aws-admin/api run test（github-user.update.test.ts 31 项，测试库：未登录 UNAUTHORIZED、更新后再查仍在、只传 tags 时 remark 不变、remark: null 清空、带 name/followers/login 等字段 BAD_REQUEST 且库无变化、超限 BAD_REQUEST、不存在 ID 返回 NOT_FOUND/RECORD_NOT_FOUND、GitHub 字段前后一致）+ pnpm exec ultracite check（本批文件），通过（第 1 轮）
  - 对应验收标准：R07-AC1 ~ R07-AC4、R07-AC6
- [✅] 5. 自测并对照 requirements.md 逐条验收
  - 说明：浏览器中分别从详情页和列表行修改并刷新确认；输入超长备注、第 11 个标签、21 字标签看到前端提示；`pnpm run check`、`pnpm run check-types` 通过
  - 对应验收标准：R07-AC1 ~ R07-AC6
  - 测试：pnpm -F @zyk-aws-admin/api run test（14 文件 322 项，使用测试数据库）+ pnpm run check-types（7 包）+ pnpm exec ultracite check（本批 15 个改动/新增的 ts/tsx 文件，0 问题） + agent-browser 登录后实测（主工作区 server:3000 + web:3001，临时账号 w6tester）：详情页和列表行分别修改并刷新确认，超长备注、第 11 个标签、21 字标签的前端提示见任务 2；全仓 `pnpm run check` 的 50 个历史错误都在本需求未改动的文件里（native、fumadocs、ui/utils、server/env），本需求改动的文件 0 问题，通过（第 1 轮）
- CR（2026-11-12）：Codex 提出 1 条，采纳 1 条（P2 编辑弹窗按视口限制高度并允许纵向滚动，已在 edit-github-user-dialog.tsx 修复）；不采纳：无
- 验收（2026-11-12，W7b）：R07-AC1～AC6 全部满足。证据：vitest github-user.update.test.ts 31 项 + schemas.test.ts 58 项通过（含「修改备注和标签后返回更新后的记录，再查数据仍在」「带 name/followers/login/githubId/avatarUrl/createdById/syncedAt 字段返回 BAD_REQUEST，数据库无变化」「备注 501 字 / 11 个标签 / 单个标签 21 字 返回 BAD_REQUEST」「保存前规范化：备注去首尾空格，标签去空格、去空、去重」「remark 为 空字符串/只有空白 时清空为 null」「不存在的 ID 返回 NOT_FOUND / RECORD_NOT_FOUND」「修改后 tags 接口返回新的标签选项」）；前端提示、只读、「已保存」、刷新仍在、「记录不存在」见任务 2、3 的浏览器记录；W7b 补测 AC6 的同步刷新（临时账号 w7b-accept@example.com，web:3001）：列表 wycats 行编辑加标签 w7b-tag 并写备注，保存后不刷新页面即自动请求 githubUser.list,githubUser.tags，该行出现 w7b-tag、标签筛选出现 w7b-tag 选项，进入详情页显示新备注；在详情页清空备注和标签后保存，自动请求 githubUser.byId，详情显示「—」「无标签」，回到列表该行标签为「—」、标签筛选只剩「全部标签」
