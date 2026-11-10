# R03 查看 GitHub 用户资料 - 任务清单

> 完成一项后把 `- [ ]` 改为 `- [✅]`

- [ ] 1. 后端 `githubUser.lookup`
  - 说明：`githubUsernameSchema` 校验 → `ctx.github.getUserByLogin` → 按 `githubId` 查 `savedId` → 返回 `toProfileDto` + `savedId`
  - 对应验收标准：R03-AC2、R03-AC3、R03-AC4、R03-AC5、R03-AC6、R03-AC9
- [ ] 2. 资料卡片组件
  - 说明：新建 `github-profile-card.tsx`（15 个字段、空值显示「—」、日期格式化）和 `external-link.tsx`（只接受 http/https，`rel="noopener noreferrer"`）
  - 对应验收标准：R03-AC7、R03-AC10
- [ ] 3. 预览页面
  - 说明：`page.tsx` 有 `username` 时渲染 `github-preview.tsx`；前端格式校验不通过时不发请求；加载中、`GITHUB_USER_NOT_FOUND`、限流（`HH:mm`）、不可用的提示；`savedId` 有值时显示「已在名单中」+「查看」，否则留出「加入数据库」的位置（R04 实现）；「返回搜索结果」带回 `q`、`page`
  - 对应验收标准：R03-AC1、R03-AC2、R03-AC3、R03-AC4、R03-AC5、R03-AC6、R03-AC8
- [ ] 4. 编写测试（`github-user.lookup.test.ts`，测试库 + 模拟的 `GithubClient`）
  - 说明：未登录 `UNAUTHORIZED`；非法用户名（`-abc`、`abc-`、`a--b`、40 位、`张三`）返回 `BAD_REQUEST` 且没有调用客户端；正常返回全部字段，日期为 ISO 字符串；数据库已有同 `githubId` 时 `savedId` 正确、没有时为 `null`；客户端抛 `GITHUB_USER_NOT_FOUND`、`GITHUB_RATE_LIMITED`、`GITHUB_UNAVAILABLE` 时原样透传；调用后 `github_user` 表行数不变
  - 对应验收标准：R03-AC2 ~ R03-AC6、R03-AC9
- [ ] 5. 自测并对照 requirements.md 逐条验收
  - 说明：浏览器中从搜索结果进入 `torvalds` 预览（耗时、字段齐全）；直接访问不存在的用户名、非法用户名（Network 中无请求）；「返回搜索结果」还原关键字和页码；博客为 `javascript:` 或无协议时不渲染为链接；`pnpm run check`、`pnpm run check-types` 通过
  - 对应验收标准：R03-AC1 ~ R03-AC10
