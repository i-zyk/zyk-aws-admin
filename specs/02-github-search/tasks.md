# R02 模糊搜索 GitHub 用户 - 任务清单

> 完成一项后把 `- [ ]` 改为 `- [✅]`

- [✅] 1. 后端 `githubUser.search`
  - 说明：`packages/api/src/routers/github-user.ts` 新增 `search`：输入校验（`searchKeywordSchema`、`page` 1～100 默认 1）、调用 `ctx.github.searchUsers`、按 `githubId` 批量查 `savedId`、计算 `exactMatch` 并置顶、计算 `hasMore`
  - 对应验收标准：R02-AC1、R02-AC2、R02-AC3、R02-AC5、R02-AC8、R02-AC10
  - 测试：`pnpm -F @zyk-aws-admin/api run test`（7 文件 140 项，含搜索输入、置顶、保存状态即时刷新、不落库、错误透传与匿名拦截）及 `check-types` 通过；`pnpm exec ultracite fix` 3 个文件无剩余问题，通过（第 1 轮）。任务 5 的接口测试提前随实现编写，任务 5 时再次核对覆盖。
- [✅] 2. 前端准备
  - 说明：`next.config.ts` 配置 `images.remotePatterns`；`npx shadcn@latest add avatar badge -c packages/ui`；新建 `apps/web/src/components/github-users/github-avatar.tsx`
  - 对应验收标准：R02-AC1
  - 测试：shadcn dry-run/view 核对依赖均已安装，实际生成未修改依赖或锁文件；读取新增文件并用 `pnpm exec ultracite fix/check`（头像、徽标、GithubAvatar、next.config 共 4 文件）通过；`pnpm -F web -F @zyk-aws-admin/ui run check-types` 通过（第 1 轮）。头像实际渲染随任务 3、6 验收。
- [✅] 3. 搜索页面
  - [✅] 3.1 `apps/web/src/app/github-users/new/page.tsx`：读取 `searchParams`，没有 `username` 时渲染搜索组件
    - 测试：agent-browser 验证 URL 页码恢复、预览占位与返回搜索结果；页面保留会话检查；web 类型检查通过（第 2 轮，用户已确认头像兼容方案）。
  - [✅] 3.2 `github-search.tsx`：TanStack Form + `searchKeywordSchema`，提交时更新 URL；根据 URL 的 `q`、`page` 查询（`staleTime: 60_000`、`refetchOnWindowFocus: false`、`retry: false`、`skipGlobalErrorToast`）
    - 测试：空白和 101 字符提交均显示校验提示，Network 无搜索请求；返回结果 60 秒内无新请求；模拟过期后 focus/visibilitychange 无新请求；web 类型检查通过（第 2 轮）。
  - [✅] 3.3 结果列表：头像、用户名、「精确匹配」「已在名单中」徽标、GitHub 外链（`rel="noopener noreferrer"`）；每行链接到 `?username=<login>&q=<q>&page=<page>`
    - 测试：真实 torvalds 搜索 969ms，精确匹配置顶，公开头像 naturalWidth 为 460/460/333 且加载成功；浏览器模拟 savedId 显示已在名单中；外链和带 q/page 的预览链接通过（第 2 轮）。
  - [✅] 3.4 总数、「上一页」「下一页」、超过 1000 的提示；加载中、空结果、错误（用 `app-error.ts` 的提示）三种状态
    - 测试：浏览器模拟空结果、限流、不可用、5000 总数和第 100 页；限流显示 13:34:56 且无重复 toast；延迟请求时搜索中按钮禁用、显示加载区；分页和返回结果通过（第 2 轮）。
  - 对应验收标准：R02-AC1、R02-AC2、R02-AC3、R02-AC4、R02-AC5、R02-AC6、R02-AC7、R02-AC8、R02-AC9、R02-AC11、R02-AC12
- [✅] 4. 占位列表页加「添加用户」入口
  - 说明：`apps/web/src/app/github-users/page.tsx` 加链接到 `/github-users/new`
  - 测试：该文件 Ultracite 检查、web 类型检查通过；agent-browser 从名单页点击添加用户后到 `/github-users/new`，显示搜索关键字输入框，通过（第 1 轮）。
  - 对应验收标准：R02-AC1
- [✅] 5. 编写测试（`github-user.search.test.ts`，测试库 + 模拟的 `GithubClient`）
  - 说明：未登录 `UNAUTHORIZED`；关键字为空格、101 个字符返回 `BAD_REQUEST`；`page` 为 0、101、小数返回 `BAD_REQUEST`；关键字带首尾空格时传给客户端的是去掉空格后的值；精确匹配（大小写不同）置顶且 `exactMatch: true`，其余顺序不变；数据库里已有的 `githubId` 得到对应 `savedId`，其他为 `null`；`hasMore` 在 total=25/page=2、total=25/page=3、total=5000/page=100 时分别为 true/false/false；客户端抛 `GITHUB_SEARCH_RATE_LIMITED`、`GITHUB_SEARCH_INVALID`、`GITHUB_UNAVAILABLE` 时原样透传；调用后 `github_user` 表行数不变
  - 对应验收标准：R02-AC2、R02-AC3、R02-AC5、R02-AC6、R02-AC8、R02-AC10、R02-AC12
  - 测试：核对任务 1 提前编写的 15 项搜索用例覆盖任务列出的全部场景；`pnpm -F @zyk-aws-admin/api run test src/routers/github-user.search.test.ts src/routers/protected.test.ts`（18 项）和这两个文件的 Ultracite 检查通过（第 1 轮）。
- [✅] 6. 自测并对照 requirements.md 逐条验收
  - 说明：浏览器中验证 `linus`、`torvalds` 搜索结果和耗时；空/超长关键字不发请求（看 Network）；翻页和从预览返回后 URL 与结果保持；输入时不发请求、60 秒内同一搜索不再请求 GitHub（看 server 日志）；可以用模拟的 GitHub 响应或临时去掉 token 验证限流提示；`pnpm run check`、`pnpm run check-types` 通过
  - 对应验收标准：R02-AC1 ~ R02-AC12
  - 测试：任务 3 的真实搜索与浏览器模拟覆盖全部界面状态；补测回车提交、URL page=101 回退第一页、入口跳转；完整 API 测试 141 项和全仓类型检查通过，当前 3 个改动源码 lint 通过（第 2 轮：发现类型限定符优先级问题，前置固定 type:user 后通过）。
  - AC10 补充：真实 GitHub API 在 `type:org type:user` 时返回 Organization，在 `type:user type:org` 时返回 User；修正固定约束位置，并增加模拟该上游行为的回归用例；通过实际 GithubClient 调用 q=type:org，10 条原始响应的 type 全为 User，搜索结果不写库。技术示例同步到 PRD 和基础设施 design，业务要求未改变。

## 续跑记录（2026-11-11，W6 暂停）

- 任务 3.1～3.4 已实现，尚未打勾：页面保留 `requireSession()`，URL 恢复搜索状态，提交触发查询、结果列表/徽标/分页、加载/空结果/错误状态均已编码。资料预览仍由 R03 实现，目前保留可返回搜索结果的占位。
- 代码检查：本次改动的 13 个 TS/TSX 文件 `pnpm exec ultracite check` 0 问题；web/ui/api 类型检查通过；API 7 文件 140 项测试通过。生成的 Field 组件改用 fieldset、严格相等和稳定错误 key，以满足项目 lint；添加 Field/Alert/Separator 源码，保留已有 Label，未改动依赖或锁文件。
- 浏览器已验证：空页面与仅输入 linus 均不发搜索请求；点击搜索后请求约 1359ms，返回 10 行，显示总数 10601、linus 精确匹配置顶及超过 1000 提示。
- 环境阻挡：`dscacheutil -q host -a name avatars.githubusercontent.com` 得到 `198.18.1.96`；Next 开发日志明确报 `hostname resolved to private IP`，`/_next/image` 返回 400 和 `"url" parameter is not allowed`，所以真实头像加载验收未通过。已处理优化图加载失败时显示用户名缩写，DOM 实测前两行回退为 LI/TO，但不能以回退替代真实头像验收。
- 恢复条件：调整本机代理/DNS，使该域名解析为公网地址，再继续浏览器验收。未启用 `dangerouslyAllowLocalIP`。按工作流测试环境问题暂停；任务 3 保持未完成，R02 尚未审查或提交。

## 恢复记录（2026-11-11）

- 用户确认仅开发环境头像设置 `unoptimized`，头像真实加载已通过，原 DNS 阻挡解除，无需修改系统配置。
- 任务 3 全部通过：真实搜索/翻页/预览返回、前端无效输入、不在输入或聚焦时请求、模拟加载/空结果/限流/不可用/已保存/第 100 页；web/ui/api 类型检查通过。未提交改动超过 800 行，进入部分提交点（任务 1～3）。

- CR 部分提交点（2026-11-11）：Codex 提出 2 条，采纳 2 条：头像启用 keepMounted，由实际 Next Image 驱动加载与回退，避免生产原图预加载；空分页保留总数与返回第一页入口，避免误判没有匹配用户。修复后回归，不复审。

- 部分提交点回归（2026-11-11，第 1 轮）：`pnpm run test`（api 140 + auth 7）和 `pnpm run check-types`（7 个任务）通过；agent-browser 对 window.Image 构造计数为 0，真实头像正常加载；阻断图片请求后显示 FA 回退；模拟 total=15、page=100、items=[]，显示当前页没有结果与总数，点击返回第一页后 URL 为 page=1；本提交点 13 个 TS/TSX 文件 lint 通过，Next MCP 无编译或运行时错误。

- CR 完成提交点（2026-11-11）：Codex 提出 0 条，采纳 0 条；无待修复项。

- 完成提交点回归（2026-11-11，第 1 轮）：`pnpm run test` 148 项通过、`pnpm run check-types` 7 个任务通过，3 个源码文件 Ultracite 检查通过；上一页返回第一页与回车搜索实测通过；Next MCP 无编译或运行时错误。全部任务与验收标准通过，R02 完成。
