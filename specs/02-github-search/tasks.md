# R02 模糊搜索 GitHub 用户 - 任务清单

> 完成一项后把 `- [ ]` 改为 `- [✅]`

- [ ] 1. 后端 `githubUser.search`
  - 说明：`packages/api/src/routers/github-user.ts` 新增 `search`：输入校验（`searchKeywordSchema`、`page` 1～100 默认 1）、调用 `ctx.github.searchUsers`、按 `githubId` 批量查 `savedId`、计算 `exactMatch` 并置顶、计算 `hasMore`
  - 对应验收标准：R02-AC1、R02-AC2、R02-AC3、R02-AC5、R02-AC8、R02-AC10
- [ ] 2. 前端准备
  - 说明：`next.config.ts` 配置 `images.remotePatterns`；`npx shadcn@latest add avatar badge -c packages/ui`；新建 `apps/web/src/components/github-users/github-avatar.tsx`
  - 对应验收标准：R02-AC1
- [ ] 3. 搜索页面
  - [ ] 3.1 `apps/web/src/app/github-users/new/page.tsx`：读取 `searchParams`，没有 `username` 时渲染搜索组件
  - [ ] 3.2 `github-search.tsx`：TanStack Form + `searchKeywordSchema`，提交时更新 URL；根据 URL 的 `q`、`page` 查询（`staleTime: 60_000`、`refetchOnWindowFocus: false`、`retry: false`、`skipGlobalErrorToast`）
  - [ ] 3.3 结果列表：头像、用户名、「精确匹配」「已在名单中」徽标、GitHub 外链（`rel="noopener noreferrer"`）；每行链接到 `?username=<login>&q=<q>&page=<page>`
  - [ ] 3.4 总数、「上一页」「下一页」、超过 1000 的提示；加载中、空结果、错误（用 `app-error.ts` 的提示）三种状态
  - 对应验收标准：R02-AC1、R02-AC2、R02-AC3、R02-AC4、R02-AC5、R02-AC6、R02-AC7、R02-AC8、R02-AC9、R02-AC11、R02-AC12
- [ ] 4. 占位列表页加「添加用户」入口
  - 说明：`apps/web/src/app/github-users/page.tsx` 加链接到 `/github-users/new`
  - 对应验收标准：R02-AC1
- [ ] 5. 编写测试（`github-user.search.test.ts`，测试库 + 模拟的 `GithubClient`）
  - 说明：未登录 `UNAUTHORIZED`；关键字为空格、101 个字符返回 `BAD_REQUEST`；`page` 为 0、101、小数返回 `BAD_REQUEST`；关键字带首尾空格时传给客户端的是去掉空格后的值；精确匹配（大小写不同）置顶且 `exactMatch: true`，其余顺序不变；数据库里已有的 `githubId` 得到对应 `savedId`，其他为 `null`；`hasMore` 在 total=25/page=2、total=25/page=3、total=5000/page=100 时分别为 true/false/false；客户端抛 `GITHUB_SEARCH_RATE_LIMITED`、`GITHUB_SEARCH_INVALID`、`GITHUB_UNAVAILABLE` 时原样透传；调用后 `github_user` 表行数不变
  - 对应验收标准：R02-AC2、R02-AC3、R02-AC5、R02-AC6、R02-AC8、R02-AC10、R02-AC12
- [ ] 6. 自测并对照 requirements.md 逐条验收
  - 说明：浏览器中验证 `linus`、`torvalds` 搜索结果和耗时；空/超长关键字不发请求（看 Network）；翻页和从预览返回后 URL 与结果保持；输入时不发请求、60 秒内同一搜索不再请求 GitHub（看 server 日志）；可以用模拟的 GitHub 响应或临时去掉 token 验证限流提示；`pnpm run check`、`pnpm run check-types` 通过
  - 对应验收标准：R02-AC1 ~ R02-AC12
