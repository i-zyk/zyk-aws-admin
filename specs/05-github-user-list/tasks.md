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
- [✅] 4. 编写测试（`github-user.list.test.ts`，测试库）
  - 说明：未登录 `UNAUTHORIZED`；关键字分别命中 `login`、`name`、`company`、`remark` 且不区分大小写，不命中 `bio` 等其他字段；标签过滤；三种排序 × 升降序的顺序正确、默认为 `createdAt desc`；`pageSize` 只接受 10/20/50，其他值 `BAD_REQUEST`；关键字 + 标签 + 排序 + 第 2 页组合结果正确、`total` 为过滤后的总数；`page` 超出范围返回空数组；`tags` 返回去重排序的全部标签；插入 1000 条后（预热一次）关键字 + 标签 + 排序的单次调用耗时 < 300ms；调用过程中模拟的 GitHub 客户端没有被调用；关键字含 `%`、`_`、`\` 时按字面匹配（CR 补充）；`page` 极大（如 214748366，偏移量超过 32 位）时返回空数组和真实 `total`（CR 补充）
  - 对应验收标准：R05-AC2 ~ R05-AC6、R05-AC8、R05-AC10
  - 测试：pnpm -F @zyk-aws-admin/api run test（10 文件 223 项，其中 github-user.list.test.ts 47 项）+ pnpm run check-types（7 包）+ pnpm exec ultracite check packages/api/src，通过（第 1 轮）
- [✅] 5. 自测并对照 requirements.md 逐条验收
  - 说明：浏览器中组合筛选、排序、翻页、切换每页条数，刷新后保持；手动改坏 URL 参数时回退默认；清空数据看空状态；从预览页加入用户后，名单列表里出现这条记录（R04-AC1 转来的列表展示部分）；`pnpm run check`、`pnpm run check-types` 通过
  - 对应验收标准：R05-AC1 ~ R05-AC11
  - 测试：pnpm -F @zyk-aws-admin/api run test（10 文件 223 项）+ pnpm run check-types --force（7 包）+ pnpm exec ultracite check apps/web/src/app/github-users apps/web/src/components/github-users packages/api/src packages/ui/src/components/{pagination,select,table}.tsx（35 文件 0 问题；全仓 `pnpm run check` 的 50 个错误都在 R05 未改动的遗留文件里，按 D3 由 R11 负责）+ agent-browser 实测 /github-users（排序 followers 升序、关键字 LINUX 不区分大小写命中公司、不命中所在地显示「清除筛选」、页码超出「回到第 1 页」、非法 URL 参数回退默认、刷新保持；拦截 tRPC 请求后显示「名单加载失败：…」+「重试」，恢复后重试成功），通过（第 1 轮）
- CR（2026-11-11）：Codex 提出 2 条，采纳 2 条；不采纳：无
- CR（2026-11-11）：Codex 提出 0 条，采纳 0 条；不采纳：无（Codex 未发现可操作问题，变更文件 lint 与 api 类型检查通过；其注明的数据库集成测试因环境只读未运行属审查说明，非问题，交 W6R 回归测试覆盖）
- 验收（W7b，2026-11-11）：R05-AC1～AC11 全部满足。证据：`varlock run --path ../db/ -- vitest run --reporter=verbose src/routers/github-user.list.test.ts src/routers/github-user.create.test.ts`（2 文件 62 项通过；list 47 项：关键字命中 login/name/company/remark 不区分大小写、不匹配 bio 等、`%`/`_`/`\` 字面匹配 → AC2；按标签过滤、tags 去重排序 → AC3；createdAt/followers/syncedAt × asc/desc、默认添加时间倒序、同值按 id 翻页不重不漏 → AC4；pageSize 10/20/50、默认 20、其他值 BAD_REQUEST、末页与超出范围 → AC5；关键字 + 标签 + 排序 + 第 2 页组合且 total 为过滤后总数 → AC6；1000 条数据关键字 + 标签 + 排序单次调用 < 300ms（用例总耗时 144ms）→ AC8；afterEach 断言 GitHub 客户端 getUserById/getUserByLogin/searchUsers 均未调用 → AC2/AC10）；agent-browser 登录后实测（开发库临时插入 25 条带标签记录，测后连同测试账号一并删除，恢复为 7 条）：表头依次为头像、用户名、昵称、公司、所在地、粉丝数、公开仓库数、标签、最后同步时间、操作，「查看」指向 `/github-users/{id}` → AC1；标签下拉选项为「全部标签、w7b-all、w7b-even」，选 w7b-even 得 12 条 → AC3；排序选项为添加时间/粉丝数/最后同步时间，每页条数选项为 10/20/50，「共 32 条，第 1 / 2 页」+ 页码 → AC4/AC5；界面上组合 `q=temp&tag=w7b-all&sort=followers&order=asc&pageSize=10` 后点第 2 页，得 tmp-11～20（粉丝 110～200）、「共 25 条，第 2 / 3 页」，刷新后输入框、下拉、升降序、数据全部保持 → AC6/AC7；`q=ACMECORP`（公司）、`q=secretkw`（备注）命中 → AC2；`sort=bogus&order=sideways&page=-3&pageSize=33` 和 `page=abc` 回退为添加时间降序、第 1 页、20 条 → AC7；拦截列表接口返回空名单时显示「名单还是空的」+「添加用户」（`/github-users/new`），`q=temp&tag=nonexist` 显示「没有匹配的记录」+「清除筛选」，点击后 URL 清空、恢复 32 条 → AC9；延迟列表请求 5 秒时显示 `role=status`「正在加载名单」骨架、切换筛选时保留旧数据并 `aria-busy`，阻断请求时显示「名单加载失败：Failed to fetch」+「重试」，解除后重试恢复 → AC10；在 `/github-users/new` 预览 kennethreitz 点「加入数据库」提示「已添加」，名单首行即 kennethreitz、总数 32 → 33 → AC11；控制台无错误
