# R03 查看 GitHub 用户资料 - 任务清单

> 完成一项后把 `- [ ]` 改为 `- [✅]`

- [✅] 1. 后端 `githubUser.lookup`
  - 说明：`githubUsernameSchema` 校验 → `ctx.github.getUserByLogin` → 按 `githubId` 查 `savedId` → 返回 `toProfileDto` + `savedId`
  - 对应验收标准：R03-AC2、R03-AC3、R03-AC4、R03-AC5、R03-AC6、R03-AC9
  - 测试：`pnpm -F @zyk-aws-admin/api run test`（7 文件 142 项）通过；临时冒烟用例核对 lookup（匿名 UNAUTHORIZED、5 种非法用户名 BAD_REQUEST 且不调用客户端、日期 ISO、savedId 有/无、GITHUB_USER_NOT_FOUND 透传、表行数不变）通过后已删除，正式用例随任务 4 编写；`pnpm run check-types` 与该文件 `pnpm exec ultracite check` 通过（第 1 轮）
- [✅] 2. 资料卡片组件
  - 说明：新建 `github-profile-card.tsx`（15 个字段、空值显示「—」、日期格式化）和 `external-link.tsx`（只接受 http/https，`rel="noopener noreferrer"`）
  - 对应验收标准：R03-AC7、R03-AC10
  - 测试：`pnpm -F web run check-types`、`pnpm exec ultracite check`（external-link.tsx、github-profile-card.tsx）通过；web 暂无单元测试框架，用临时 SSR 冒烟脚本（tsx + react-dom/server renderToStaticMarkup，脚本放在临时目录、未入库）核对 14 个字段标签 + 头像 alt、日期 YYYY-MM-DD（UTC）、zh-CN 千分位、空值与空白显示「—」、无效日期显示「—」、Twitter 链到 x.com、博客 https 渲染为带 `rel="noopener noreferrer"` `target="_blank"` 的链接、`javascript:`/`data:`/无协议/大写 JAVASCRIPT 不渲染链接、简介中的 `<script>` 被转义、邮箱无 mailto、children 渲染到卡片底部，通过（第 1 轮）
- [✅] 3. 预览页面
  - 说明：`page.tsx` 有 `username` 时渲染 `github-preview.tsx`；前端格式校验不通过时不发请求；加载中、`GITHUB_USER_NOT_FOUND`、限流（`HH:mm`）、不可用的提示；`savedId` 有值时显示「已在名单中」+「查看」，否则留出「加入数据库」的位置（R04 实现）；「返回搜索结果」带回 `q`、`page`
  - 对应验收标准：R03-AC1、R03-AC2、R03-AC3、R03-AC4、R03-AC5、R03-AC6、R03-AC8
  - 测试：`pnpm -F web run check-types`、`pnpm exec ultracite check`（page.tsx、github-preview.tsx 等本批文件）、`pnpm -F @zyk-aws-admin/api run test`（7 文件 142 项）通过；agent-browser 实际打开页面（登录后）核对：从搜索结果点击 torvalds 进入预览、资料卡片字段齐全，「返回搜索结果」还原 `q`/`page`，直接访问时回到 `/github-users/new`；不存在的用户名提示「GitHub 上没有找到该用户」；`-abc`、`abc-`、`a--b`、40 位、`张三` 提示「用户名格式不正确」且无 lookup 请求；临时插入同 githubId 记录时显示「已在名单中」+「查看」（`/github-users/1`）且无「加入数据库」，测后已删除；限流 `HH:mm`、不可用文案用临时 tsx 脚本核对 `getAppErrorMessage`；Next MCP 无错误，通过（第 1 轮）
- [✅] 4. 编写测试（`github-user.lookup.test.ts`，测试库 + 模拟的 `GithubClient`）
  - 说明：未登录 `UNAUTHORIZED`；非法用户名（`-abc`、`abc-`、`a--b`、40 位、`张三`）返回 `BAD_REQUEST` 且没有调用客户端；正常返回全部字段，日期为 ISO 字符串；数据库已有同 `githubId` 时 `savedId` 正确、没有时为 `null`；客户端抛 `GITHUB_USER_NOT_FOUND`、`GITHUB_RATE_LIMITED`、`GITHUB_UNAVAILABLE` 时原样透传；调用后 `github_user` 表行数不变
  - 对应验收标准：R03-AC2 ~ R03-AC6、R03-AC9
  - 测试：`pnpm -F @zyk-aws-admin/api run test`（8 文件 158 项，其中 `github-user.lookup.test.ts` 16 项）、`pnpm -F @zyk-aws-admin/api run check-types`、`pnpm exec ultracite check`（github-user.lookup.test.ts、github-user.ts），通过（第 1 轮）
- [✅] 5. 自测并对照 requirements.md 逐条验收
  - 说明：浏览器中从搜索结果进入 `torvalds` 预览（耗时、字段齐全）；直接访问不存在的用户名、非法用户名（Network 中无请求）；「返回搜索结果」还原关键字和页码；博客为 `javascript:` 或无协议时不渲染为链接；`pnpm run check`、`pnpm run check-types` 通过
  - 对应验收标准：R03-AC1 ~ R03-AC10
  - 测试：`pnpm -F @zyk-aws-admin/api run test`（8 文件 158 项）、`pnpm run check-types`（7 包）、`pnpm exec ultracite check`（apps/web/src/app/github-users、apps/web/src/components/github-users、packages/api/src/routers）通过；`pnpm run check` 全仓 50 个错误均在本需求未改动的旧文件（fumadocs、native、ui、login/sign-in 表单等），本批文件无问题；agent-browser 登录后实测：从 `q=torvalds` 搜索结果点击进入预览约 1.0 秒、15 个字段与头像 alt 齐全；`q=linus&page=2` 进入预览后「返回搜索结果」还原 `q=linus&page=2` 且输入框为 linus，直接访问时回到 `/github-users/new`；不存在的用户名提示「GitHub 上没有找到该用户」；`-abc`、`abc-`、`a--b`、40 位、`张三` 提示「用户名格式不正确」且 lookup 请求数为 0（合法用户名为 1）；真实无协议博客 `danabra.mov`（gaearon）显示为纯文本，临时 SSR 脚本核对 `javascript:`/`JAVASCRIPT:`/`data:` 不渲染链接、https 带 `rel="noopener noreferrer"`；控制台无错误，通过（第 1 轮）
- CR（2026-11-11）：Codex 提出 0 条，采纳 0 条；不采纳：无（Codex 未发现可操作问题，web/api 类型检查与变更文件 Ultracite 检查通过；其注明的数据库测试因环境只读未运行属审查说明，非问题，交 W6R 回归测试覆盖）
- 验收（W7b，2026-11-11）：R03-AC1～AC10 全部满足。证据：`varlock run --path ../db/ -- vitest run --reporter=verbose`（8 文件 158 项通过；`github-user.lookup.test.ts` 16 项覆盖 UNAUTHORIZED、6 种非法用户名 BAD_REQUEST 且不调客户端、savedId 按 githubId、表行数不变、三类错误透传；`client.test.ts` 覆盖 x-ratelimit-reset → resetAt、超时 → GITHUB_UNAVAILABLE；`errors.test.ts` 覆盖响应 JSON 带 appCode/resetAt）；agent-browser 登录后实测：`q=linus&page=2` 点击 Linusp 约 1.03 秒显示卡片，15 项字段齐全、空值「—」，外链均 `rel="noopener noreferrer"` `target="_blank"`，「返回搜索结果」回到 `?page=2&q=linus` 且输入框为 linus，直接访问时为 `/github-users/new`；不存在用户名提示「GitHub 上没有找到该用户」；`-abc`、`abc-`、`a--b`、40 位、`张三` 提示「用户名格式不正确」且 lookup 请求数 0（合法用户名为 1）；拦截 lookup 响应模拟限流显示「GitHub 请求过于频繁，请在 06:02 之后重试」（与 resetAt 本地时间一致）、模拟不可用显示「GitHub 暂时无法访问，请稍后重试」、模拟 savedId=42 显示「已在名单中」+「查看」（`/github-users/42`）且无「加入数据库」、简介中的 HTML 被转义且未执行、`javascript:` 博客显示为纯文本；`grep dangerouslySetInnerHTML` 本需求目录无匹配
