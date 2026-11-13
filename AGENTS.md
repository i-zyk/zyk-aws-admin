# zyk-aws-admin 项目说明

由 [Better-T-Stack](https://better-t-stack.dev) v3.49.0 生成的 TypeScript 全栈 monorepo（生成参数见 `bts.jsonc`）。

**已实现的业务功能**：`docs/需求.md`（PRD v0.3）描述的「GitHub 用户管理后台」已在分支 `workflow/20261110` 上完成（R00～R11，规格见 `specs/`）：开放注册 + 登录限流、模糊搜索 GitHub 用户、查看资料、加入数据库、名单列表（搜索/标签筛选/排序/分页）、详情、修改备注和标签、从 GitHub 同步、删除和批量删除。移动端未接入，生产部署尚未确定。

## 技术栈

| 层 | 技术 |
| --- | --- |
| Monorepo | pnpm workspace（`pnpm@12`，`node-linker=isolated`）+ Turborepo，依赖版本统一在 `pnpm-workspace.yaml` 的 `catalog:` 中 |
| Web 前端 | Next.js 16（App Router、`typedRoutes`、React Compiler）+ React 19 + Tailwind v4 + shadcn/ui（`base-lyra` 风格，基于 Base UI） |
| 移动端 | Expo 58 + React Native 0.88 + Expo Router（Drawer + Tabs）+ HeroUI Native + Uniwind（RN 版 Tailwind v4） |
| 后端 | Hono 4，运行在 Node（`@hono/node-server`），开发用 `tsx watch`，构建用 `tsdown` |
| API | tRPC 11 + TanStack Query 5（`@trpc/tanstack-react-query`），端到端类型安全 |
| 认证 | Better Auth 1.7（邮箱密码登录 + `@better-auth/expo` 插件） |
| 数据库 | PostgreSQL + Prisma 7（`prisma-client` 生成器 + `@prisma/adapter-pg` 驱动适配器） |
| 环境变量 | Varlock（每个应用用 `.env.schema` 声明，代码生成带类型的 `src/env.ts`） |
| 文档站 | Fumadocs（Next.js + MDX），提供 `llms.txt` / `llms-full.txt` 和 OG 图 |
| 表单 | TanStack Form；校验用 Zod 4 |
| 代码质量 | Biome + Ultracite（Tab 缩进、双引号），AI 编辑后通过钩子自动执行 `ultracite fix` |

## 目录结构

```
zyk-aws-admin/
├── apps/
│   ├── web/                # Next.js 管理后台，端口 3001
│   │   └── src/
│   │       ├── app/        # 路由：/login；/github-users（名单）、/github-users/new（搜索并加入）、/github-users/[id]（详情）；/ 和 /dashboard 重定向到 /github-users
│   │       ├── components/ # header、providers、登录/注册表单、user-menu、主题切换；github-users/ 下为头像、资料卡、编辑/删除/批量删除对话框、同步按钮等
│   │       ├── lib/        # auth-client（Better Auth React 客户端）、require-session（后台页面鉴权）、app-error（错误码转提示）
│   │       └── utils/trpc.ts       # tRPC 客户端 + QueryClient（全局 onError 弹 toast）
│   ├── native/             # Expo 移动端（scheme: zyk-aws-admin）
│   │   ├── app/            # Expo Router：_layout → (drawer) → (tabs)，另有 modal、+not-found
│   │   ├── components/     # sign-in、sign-up、container、theme-toggle
│   │   ├── contexts/       # app-theme-context
│   │   ├── lib/auth-client.ts  # Better Auth + expoClient，会话存 SecureStore
│   │   ├── utils/trpc.ts       # tRPC 客户端（原生端手动带 Cookie 请求头）
│   │   └── babel-plugins/      # Hermes 兼容用的自定义 Babel 插件
│   ├── server/             # Hono API 服务，端口 3000
│   │   └── src/
│   │       ├── index.ts    # 入口：logger、CORS、/api/auth/*、/trpc/*、GET / 健康检查
│   │       ├── services.ts # 组装根：根据 ENV 创建 db、auth、github（GitHub 客户端）单例
│   │       ├── context.ts  # tRPC 上下文 { db, github, session }
│   │       └── env.server.ts   # 加载 varlock/auto-load 并导出 ENV
│   └── fumadocs/           # 文档站，端口 4000；content/docs/*.mdx 为文档内容
├── packages/
│   ├── api/                # @zyk-aws-admin/api：tRPC 实例、publicProcedure/protectedProcedure、appRouter
│   │   └── src/
│   │       ├── routers/github-user.ts  # githubUser.*：search、lookup、create、list、tags、byId、update、sync、delete、deleteMany
│   │       ├── github/     # GitHub REST 客户端（createGithubClient）、响应 schema、映射、缓存
│   │       └── errors.ts   # 业务错误码 AppCode 和 appError()，经 errorFormatter 放进 data.appCode
│   ├── auth/               # @zyk-aws-admin/auth：createAuth(env, db) 工厂函数、Session 类型
│   ├── db/                 # @zyk-aws-admin/db：createPrismaClient(env) 工厂函数、Prisma schema 和迁移
│   │   └── prisma/
│   │       ├── schema/schema.prisma  # 生成器和数据源配置
│   │       ├── schema/auth.prisma    # Better Auth 表（User/Session/Account/Verification），由 auth:generate 生成
│   │       ├── schema/github-user.prisma  # GithubUser 表（保存的 GitHub 用户名单）
│   │       ├── migrations/           # 20261110142224_init 起
│   │       └── generated/            # Prisma Client 输出目录（已加入 gitignore）
│   ├── ui/                 # @zyk-aws-admin/ui：共享的 shadcn 组件、globals.css 设计变量（只有 web 在用）
│   └── config/             # @zyk-aws-admin/config：tsconfig.base.json（strict、noUncheckedIndexedAccess）
├── docs/需求.md            # PRD（v0.3，GitHub 用户管理后台）
├── specs/                  # 需求拆分后的规格目录：README.md 总览 + 00-foundation～11-legacy-lint-cleanup
├── .agents/skills/         # 项目级 AI 技能；.claude/skills/ 是指向这里的符号链接
├── .mcp.json               # MCP：better-t-stack、context7、shadcn、next-devtools、better-auth、expo
├── biome.json / turbo.json / pnpm-workspace.yaml / bts.jsonc
```

## 架构与数据流

```
web (Next.js :3001) ──┐   httpBatchLink /trpc + Cookie（credentials: include）
                      ├──▶ server (Hono :3000) ──▶ packages/api (appRouter)
native (Expo) ────────┘   原生端：authClient.getCookie() 放进 Cookie 请求头       │
                                │                                              ▼
                                └─ /api/auth/* ─▶ packages/auth (Better Auth) ─▶ packages/db (Prisma) ─▶ PostgreSQL
```

- **依赖方向**：`apps/server` → `api` → `auth` → `db`；`apps/web` 和 `apps/native` 只从 `api` 导入 `AppRouter` **类型**，不导入任何运行时代码。`ui` 只被 `web` 使用。
- **依赖注入**：共享包不直接读取环境变量。`db` 和 `auth` 只导出工厂函数（`createPrismaClient(env)`、`createAuth(env, db)`），由 `apps/server/src/services.ts` 统一传入 `ENV` 并创建单例。新增需要配置的共享包时沿用这种方式。
- **内部包不单独构建**：各包的 `exports` 直接指向 `src/*.ts` 源码；server 用 `tsdown` 打包时，通过 `alwaysBundle: [/@zyk-aws-admin\/.*/]` 把内部包一起打进产物。
- **tRPC**：在 `packages/api/src/routers/` 中新增 router，并合并进 `appRouter`。需要登录的接口用 `protectedProcedure`（没有会话时抛 `UNAUTHORIZED`，`ctx.session` 保证非空）。上下文为 `{ db: Database, github: GithubClient, session: Session | null }`。业务错误用 `packages/api/src/errors.ts` 的 `appError()` 抛出，前端按 `data.appCode` 显示提示。
- **认证**：Better Auth 挂载在 server 的 `/api/auth/*`。Cookie 设置为 `sameSite=none; secure; httpOnly`，允许跨域。`trustedOrigins` 包含 `CORS_ORIGIN`、`zyk-aws-admin://`、`exp://`、`http://localhost:8081`。注册和登录接口按 IP 限流（各自 60 秒 5 次，计数在进程内存）。web 的后台页面（layout 和每个 page）都调用 `@/lib/require-session` 的 `requireSession()` 在服务端校验会话，未登录跳转 `/login`。
- **数据库**：Prisma 使用多文件 schema（`prisma/schema/` 目录）。修改 schema 后需要执行 `db:generate`；新增或调整 Better Auth 插件后，先执行 `auth:generate` 重新生成 `auth.prisma`，再执行迁移。

## 环境变量（Varlock）

- 每个应用在 `.env.schema` 中声明变量（已提交），真实值放在 `.env`（已忽略）。`src/env.ts` 是生成文件，**不要手改**，也不要提交。修改 schema 后执行 `pnpm run env:generate`（`postinstall` 也会自动执行）。
- `apps/server`：`NODE_ENV`、`BETTER_AUTH_SECRET`（长度 ≥ 32）、`BETTER_AUTH_URL`、`CORS_ORIGIN`、`DATABASE_URL`、`GITHUB_TOKEN`（可选、敏感；只读公开资料，不配置时 GitHub 搜索每分钟 10 次、资料查询每小时 60 次）
- `apps/web`：`NEXT_PUBLIC_SERVER_URL`；`apps/native`：`EXPO_PUBLIC_SERVER_URL`
- `packages/db/.env.schema` 从 `apps/server` 中 `@import` 出 `DATABASE_*`，所以 Prisma CLI 能读到同一份配置。
- 新增全局环境变量时，同时加到 `turbo.json` 的 `globalEnv` 中。

## 常用命令（在仓库根目录执行）

| 命令 | 作用 |
| --- | --- |
| `pnpm install` | 安装依赖，并自动生成 env 类型 |
| `pnpm run db:generate` | 生成 Prisma Client（开发、类型检查、构建之前都需要先执行） |
| `pnpm run db:push` / `db:migrate` / `db:studio` | 同步 schema / 创建迁移 / 打开 Prisma Studio |
| `pnpm -F @zyk-aws-admin/db run db:migrate:deploy` | 把已有迁移应用到数据库（不生成新迁移） |
| `pnpm run auth:generate` | 根据 Better Auth 配置重新生成 `auth.prisma` |
| `pnpm run dev` / `dev:web` / `dev:server` / `dev:native` | 启动全部 / 单个应用 |
| `pnpm run build` / `check-types` | 构建 / 全仓库类型检查 |
| `pnpm run check` / `fix` | Ultracite 检查 / 自动修复（R11 后全仓 0 错误） |
| `pnpm run test` | 运行 Vitest（`packages/api`、`packages/auth`，使用独立测试库，需要本地 PostgreSQL） |

## 注意事项

- `apps/web/AGENTS.md`：Next.js 16 的 API 和约定与旧版本不同，写 web 代码前先查 `apps/web/node_modules/next/dist/docs/`。
- `apps/fumadocs` 相对独立：有自己的 `biome.json`，使用 TypeScript 7，没有使用 catalog，类型检查脚本名为 `types:check`（不是 `check-types`）。
- 共享 UI 组件用 `npx shadcn@latest add <组件> -c packages/ui` 添加，导入方式为 `@zyk-aws-admin/ui/components/<name>`；只给 web 用的组件在 `apps/web` 中添加。
- 移动端 UI 使用 HeroUI Native + Uniwind 的 className，不要使用 shadcn/web 组件。
- 用 pnpm 管理依赖。仓库里的 `bunfig.toml` 只是用来关闭 Bun 自动加载 `.env`，不代表项目使用 Bun。

---

# Ultracite Code Standards

This project uses **Ultracite**, a zero-config preset that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `pnpm exec ultracite fix`
- **Check for issues**: `pnpm exec ultracite check`
- **Diagnose setup**: `pnpm exec ultracite doctor`

Biome (the underlying engine) provides robust linting and formatting. Most issues are automatically fixable.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance

**Next.js:**

- Use Next.js `<Image>` component for images
- Use `next/head` or App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client Components

**React 19+:**

- Use ref as a prop instead of `React.forwardRef`

**Solid/Svelte/Vue/Qwik:**

- Use `class` and `for` attributes (not `className` or `htmlFor`)

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Biome Can't Help

Biome will catch most mechanical issues automatically. Focus your attention on:

1. **Business logic correctness** - Biome can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Biome. Run `pnpm exec ultracite fix` before committing to ensure compliance.

## 经验与踩坑

- [2026-11-10][R00] 测试进程本身拿不到 `DATABASE_URL`；`packages/api` 的 `test` 脚本用 `varlock run --path ../db/ -- vitest run` 从 `packages/db` 加载环境变量，新增需要数据库的测试包照此写。
- [2026-11-10][R00] 测试一律走 `zyk_aws_admin_test` 测试库：`globalSetup` 建库并 `prisma migrate deploy`，`setupFiles` 把 `DATABASE_URL` 改指向测试库；`packages/db/src/testing.ts` 拒绝对非 `_test` 结尾的库操作，只能在测试中导入，业务代码不要用。
- [2026-11-10][R00] 新增服务端环境变量要三处同步：`apps/server/.env.schema` 声明（敏感项标 sensitive）→ `pnpm run env:generate` 重新生成 `apps/server/src/env.ts` → `turbo.json` 的 `globalEnv` 加上变量名；`GITHUB_TOKEN` 只在服务端，web/native 不得出现。
- [2026-11-10][R00] 检查迁移与 schema 是否一致用 `cd packages/db && varlock run -- npx prisma migrate diff --from-config-datasource --to-schema prisma/schema --exit-code`（输出 No difference 即一致），再配合 `prisma migrate status`；全仓 lint 有基线遗留错误（由 R11 清理），各需求只对自己改动的文件跑 `pnpm exec ultracite check <文件...>`。（R11 已完成，现在全仓 `pnpm run check` 应为 0 错误，直接跑全仓即可。）
- [2026-11-10][R01] web 开了 typedRoutes，`router.push("/xxx")` 指向的路由必须已有 `page.tsx`，否则 check-types 报错；跳转到还没实现的页面时先建占位 `page.tsx`。
- [2026-11-10][R01] turbo 会并行跑各包的 `test`，多个包共用一个测试库会互相干扰；每个需要数据库的测试包在 `globalSetup` 里给 `getTestDatabaseUrl` 传自己的后缀（如 auth 用 `_auth_test`），各用独立测试库。
- [2026-11-10][R01] 不存在的 Next.js 子路由直接渲染根 404，不经过其父目录的受保护 layout；验收未来页面的登录跳转前先建占位 page，R01 已为 new 和 [id] 建好占位页。
- [2026-11-11][R01] Next.js 共享布局在客户端导航时会复用，不能只在 layout 中鉴权；所有后台 page 在渲染前调用 `@/lib/require-session` 的 `requireSession()`（React cache 仅请求内去重），R02/R05/R06 替换占位页时必须保留。
- [2026-11-11][R02] API 包内的数据库测试文件共用一个测试库，Vitest 使用 `fileParallelism: false` 防止各文件 reset 相互干扰；跨包仍按 R01 约定分库。
- [2026-11-11][R02] 本机 Fake-IP 导致 GitHub 头像解析为 198.18 地址，Next 图片优化会拒绝；用户确认仅 `GithubAvatar` 在 development 使用 `unoptimized`，生产仍优化，GitHub API 仍走服务端。
- [2026-11-11][R02] `.next/types` 的旧构建路由类型与 `.next/dev/types` 不一致时会让已存在路由的 typedRoutes 校验失败；运行 `pnpm -F web exec next typegen` 重新生成，保留正在运行的 `.next/dev`。
- [2026-11-11][R02] Base UI AvatarImage 搭配 Next Image 时使用 `keepMounted`，让实际 img 的 load/error 驱动状态；默认模式会先下载原始 src，导致生产原图和优化图重复加载。加载/错误时隐藏实际图并保留 AvatarFallback。
- [2026-11-11][R02] GitHub 用户搜索重复 type 限定符时实测采用第一个；固定 `type:user` 必须放在用户关键字之前，末尾追加会被输入 type:org 覆盖。已增加回归测试，并同步 PRD/技术设计中的 URL 示例。
- [2026-11-11][R02] agent-browser 的 find/fill 会给元素添加 data-agent-browser-located；在 SSR 表单尚未水合时操作会引入工具造成的 hydration 警告。先用不改 DOM 的 wait --fn 等待查询结果/图片就绪，再操作；重开浏览器后 Next MCP 无错误。
- [2026-11-11][R03] web 包暂无单元测试框架；纯展示组件用临时目录里的 tsx + `react-dom/server` `renderToStaticMarkup` 冒烟脚本核对输出（不入库），日期按 UTC 格式化避免时区导致结果漂移。
- [2026-11-11][R03] 全仓 `pnpm run check` 目前有约 50 个历史错误（fumadocs、native、ui、login/sign-in 表单等未改动文件）；验收时对本批改动的目录单独跑 `pnpm exec ultracite check <路径>` 判断是否通过。（已过时：R11 已清零。）
- [2026-11-11][R04] `@prisma/adapter-pg` 下 P2002 的 `meta.target` 为空，约束名只在 `meta.driverAdapterError.cause.constraint` 里；判断唯一约束冲突统一用 `@zyk-aws-admin/db` 的 `isUniqueConstraintError(error, field?)`，不要直接读 `meta.target`。
- [2026-11-12][R11] 根 Biome 原本会检查工作流状态文件 `.workflow/state.json`（git 已排除但 Biome 不读 info/exclude）；已在根 `biome.json` 的 includes 加 `!.workflow`，以后新增本地工具目录同样在这里排除。
- [2026-11-12][R11] R11 任务 3 后全仓 `pnpm run check` 已为 0 错误（前述「基线遗留错误」条目失效）；之后改动应保持全仓 check 干净，不用 `biome-ignore` 或在根 `biome.json` 排除目录/关规则规避。
- [2026-11-12][R11] 全仓 lint 基线已清零（`pnpm run check` 0 错误），此后各需求应直接跑全仓 `pnpm run check`，不再只查改动文件；`packages/ui/src/lib/utils.ts` 仅对该文件关闭 `noBarrelFile`（shadcn 约定），不要加 `biome-ignore` 或在根 `biome.json` 排除目录。
- [2026-11-12][R11] metro 配置必须是 `apps/native/metro.config.cjs` + `__dirname`，不要改回 `.js` 或 `import.meta.dirname`：`.js` 下 `ultracite fix` 会把 `__dirname` 改成 `import.meta.dirname`，文件含 `import.meta` 会被按 ES 模块解析，`module.exports` 失效、`require` 得到空对象，`expo export` 加载配置即报错（根 `package.json` 的 `"type": "module"` 不是原因，`apps/native` 有自己的 `package.json`）；`.cjs` 明确是 CommonJS，Biome 不会再改，metro-config 也支持 `.cjs`。
- [2026-11-12][R11] 根 `biome.json` 的 `vcs.useIgnoreFile` 为 false，跑过 Expo 后生成的 `apps/native/expo-env.d.ts`、`uniwind-types.d.ts` 虽被 gitignore 仍会被 Biome 检查报 format 错；已在根 `files.includes` 逐个排除，以后新增工具生成文件同样按文件排除，不排除目录。
