# R01 注册与登录（开放注册 + 限流 + 登录跳转） - 任务清单

> 完成一项后把 `- [ ]` 改为 `- [✅]`

- [ ] 1. 开启注册和登录限流
  - 说明：`packages/auth/src/index.ts` 加 `rateLimit`（`enabled: true`，`/sign-up/email`、`/sign-in/email` 各 60 秒 5 次）
  - 对应验收标准：R01-AC3
- [ ] 2. 注册、登录表单
  - 说明：`sign-up-form.tsx`、`sign-in-form.tsx` 成功后跳 `/github-users`；429 提示「操作过于频繁，请稍后再试」；重复邮箱提示「该邮箱已注册」；保留密码 8 位和邮箱格式校验；文案改中文
  - 对应验收标准：R01-AC1、R01-AC2、R01-AC3、R01-AC7、R01-AC9
- [ ] 3. 后台页面保护和跳转
  - 说明：新建 `apps/web/src/app/github-users/layout.tsx`（无会话跳 `/login`）和占位 `page.tsx`；`/`、`/dashboard` 改为跳转 `/github-users`；删除 `dashboard/dashboard.tsx`
  - 对应验收标准：R01-AC4、R01-AC7
- [ ] 4. 导航和退出登录
  - 说明：`header.tsx` 导航「GitHub 用户」；`user-menu.tsx` 退出后 `push("/login")` + `refresh()`
  - 对应验收标准：R01-AC6、R01-AC8
- [ ] 5. README 写明开放注册风险
  - 对应验收标准：R01-AC9
- [ ] 6. 编写测试
  - [ ] 6.1 `packages/auth/src/index.test.ts`（测试库 + `auth.handler(new Request(...))`）：注册成功返回会话 Cookie（自动登录）；同一邮箱再次注册返回 `USER_ALREADY_EXISTS` 类错误码；同一 IP 连续注册 5 次都不是 429、第 6 次是 429；登录同理且与注册分开计数；换一个 `x-forwarded-for` 的 IP 不受影响；退出登录后用原 Cookie 调 `getSession` 得到 `null`
  - [ ] 6.2 `packages/api/src/routers/protected.test.ts`：`session: null` 时，`githubUserRouter` 中每个 procedure 和现有 `privateData` 都抛 `UNAUTHORIZED`（遍历 `_def.procedures`，后续需求新增的接口自动纳入）
  - 对应验收标准：R01-AC1 ~ R01-AC6
- [ ] 7. 自测并对照 requirements.md 逐条验收
  - 说明：启动 `pnpm run dev:server` 和 `pnpm run dev:web`，在浏览器里验证注册自动登录并跳转、重复邮箱提示、第 6 次注册的限流提示、未登录访问三个后台路径都跳 `/login`、`/` 和 `/dashboard` 跳转、退出后回到 `/login`；`pnpm run check`、`pnpm run check-types` 通过
  - 对应验收标准：R01-AC1 ~ R01-AC9
