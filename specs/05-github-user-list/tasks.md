# R05 名单列表 - 任务清单

> 完成一项后把 `- [ ]` 改为 `- [✅]`

- [✅] 1. 后端 `githubUser.list` 和 `githubUser.tags`
  - 说明：`schemas.ts` 加 `githubUserListInputSchema`；`list` 组合关键字（4 个字段 `contains` + `insensitive`）、标签（`has`）、排序（加 `id` 次序）、分页，`$transaction` 取数据和总数；`tags` 用 `$queryRaw` 去重排序
  - 对应验收标准：R05-AC2、R05-AC3、R05-AC4、R05-AC5、R05-AC6、R05-AC8
  - 测试：pnpm -F @zyk-aws-admin/api run test（9 文件 176 项）+ pnpm run check-types + pnpm exec ultracite check packages/api/src，通过（第 1 轮）
- [✅] 2. 前端准备
  - 说明：`npx shadcn@latest add table select pagination -c packages/ui`；新建 `tag-list.tsx`
  - 对应验收标准：R05-AC1
  - 测试：pnpm run check-types --force（7 包，含 ui / web）+ pnpm exec ultracite check apps/web/src/components/github-users packages/ui/src/components/{pagination,select,table}.tsx（web / ui 无单元测试；tag-list 尚未接入页面，页面验证留到任务 3/5），通过（第 1 轮）
- [✅] 3. 列表页面
  - [✅] 3.1 `page.tsx` 读取 `searchParams`；`github-user-list.tsx` 解析 URL 参数（不合法回退默认），筛选变化时更新 URL 并重置页码
  - [✅] 3.2 筛选栏：关键字（回车或按钮提交）、标签下拉、排序字段 + 升降序、每页条数
  - [✅] 3.3 表格 10 列（头像用 `github-avatar.tsx`，最后同步时间格式化，操作列「查看」链接到 `/github-users/{id}`）；总数和分页
  - [✅] 3.4 加载中、空名单（「添加用户」）、筛选无结果（「清除筛选」）、出错四种状态
  - 对应验收标准：R05-AC1 ~ R05-AC7、R05-AC9、R05-AC10
  - 测试：pnpm run check-types --force（7 包）+ pnpm exec ultracite check apps/web/src/app/github-users apps/web/src/components/github-users（13 文件）+ pnpm -F @zyk-aws-admin/api run test（9 文件 176 项）+ agent-browser 打开 /github-users 实测（10 列表格、关键字不区分大小写、排序字段/升降序、每页条数、筛选变化页码重置为 1、刷新保持、非法 URL 参数回退默认、无结果「清除筛选」、页码超出「回到第 1 页」、「查看」跳转详情，控制台无报错；开发库仅 7 条且无标签，多页分页和标签过滤留到任务 4/5），通过（第 1 轮）
- [ ] 4. 编写测试（`github-user.list.test.ts`，测试库）
  - 说明：未登录 `UNAUTHORIZED`；关键字分别命中 `login`、`name`、`company`、`remark` 且不区分大小写，不命中 `bio` 等其他字段；标签过滤；三种排序 × 升降序的顺序正确、默认为 `createdAt desc`；`pageSize` 只接受 10/20/50，其他值 `BAD_REQUEST`；关键字 + 标签 + 排序 + 第 2 页组合结果正确、`total` 为过滤后的总数；`page` 超出范围返回空数组；`tags` 返回去重排序的全部标签；插入 1000 条后（预热一次）关键字 + 标签 + 排序的单次调用耗时 < 300ms；调用过程中模拟的 GitHub 客户端没有被调用；关键字含 `%`、`_`、`\` 时按字面匹配（CR 补充）；`page` 极大（如 214748366，偏移量超过 32 位）时返回空数组和真实 `total`（CR 补充）
  - 对应验收标准：R05-AC2 ~ R05-AC6、R05-AC8、R05-AC10
- [ ] 5. 自测并对照 requirements.md 逐条验收
  - 说明：浏览器中组合筛选、排序、翻页、切换每页条数，刷新后保持；手动改坏 URL 参数时回退默认；清空数据看空状态；从预览页加入用户后，名单列表里出现这条记录（R04-AC1 转来的列表展示部分）；`pnpm run check`、`pnpm run check-types` 通过
  - 对应验收标准：R05-AC1 ~ R05-AC11
- CR（2026-11-11）：Codex 提出 2 条，采纳 2 条；不采纳：无
