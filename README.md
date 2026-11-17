# zyk-aws-admin

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines Next.js, Hono, TRPC, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **Next.js** - Full-stack React framework
- **React Native** - Build mobile apps using React
- **Expo** - Tools for React Native development
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Shared UI package** - shadcn/ui primitives live in `packages/ui`
- **Hono** - Lightweight, performant server framework
- **tRPC** - End-to-end type-safe APIs
- **Node.js** - Runtime environment
- **Prisma** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **Authentication** - Better-Auth
- **Turborepo** - Optimized monorepo build system
- **Biome** - Linting and formatting

## 功能：GitHub 用户管理后台

需求见 [docs/需求.md](docs/需求.md)（PRD v0.3），拆分后的规格和进度见 [specs/README.md](specs/README.md)。登录后访问 web 的 `/github-users`（`/` 和 `/dashboard` 会跳转过去），未登录跳转 `/login`。

- **注册与登录**：邮箱 + 密码，开放注册，注册和登录接口按 IP 限流（见下节）。
- **搜索并加入**（`/github-users/new`）：按关键字模糊搜索 GitHub 用户（固定只搜个人用户），选中后查看公开资料，确认后存进数据库；同一用户名不能重复加入。
- **名单列表**（`/github-users`）：按用户名、姓名、公司、备注搜索，按标签筛选、排序、分页；可多选后批量删除（每次最多 100 条）。
- **详情**（`/github-users/[id]`）：查看保存的资料，修改备注和标签，从 GitHub 重新同步最新资料，删除记录（物理删除）。
- **接口**：全部在 tRPC 的 `githubUser.*` 下（`packages/api/src/routers/github-user.ts`），都需要登录；GitHub API 只在服务端调用。
- 移动端 `apps/native` 本期不接入；生产部署见下文「部署」。

## 开放注册的风险

开放注册：任何注册用户都能修改和删除全部数据并消耗共用的 GitHub 额度，本期用注册限流降低滥用。

- 任何人都可以用邮箱和密码注册，注册后即为管理员，所有用户权限相同，没有多角色区分。
- 注册（`/sign-up/email`）和登录（`/sign-in/email`）接口按 IP 限流：各自 60 秒内最多 5 次，第 6 次返回 `429`；开发环境同样生效。
- 限流计数存在数据库的 `rateLimit` 表里，服务重启不清空，多个 Lambda 实例共享。
- 客户端 IP 优先取 `x-client-ip` 请求头（生产环境由 Cloudflare Worker 用 `CF-Connecting-IP` 写入并覆盖客户端自带的值），没有时取 `x-forwarded-for`。本地开发直连后端时客户端可以自己伪造这两个请求头，限流只在生产链路上可靠。

## 部署

- **前端**：`apps/web` 用 OpenNext 打包成 Cloudflare Worker，推送到 main 时由 `.github/workflows/deploy-web.yml` 发布到 `admin.izyk.online`。
- **后端**：`apps/server` 部署到 AWS Lambda（API Gateway HTTP API，IAM 鉴权），用 AWS SAM 管理，进行中。
  - Lambda 入口是 `src/lambda.ts`，本地 Node 入口是 `src/index.ts`，两者共用 `src/app.ts`。
  - `pnpm -F server run build:lambda` 把所有依赖打进 `apps/server/dist-lambda/`（Handler：`index.handler`），部署时不需要 `node_modules`。打包前先 `pnpm run db:generate`。
  - Lambda 上没有 `.env` 和 varlock CLI，环境变量由 `src/lambda-env.ts` 用 zod 校验，规则和 `apps/server/.env.schema` 保持一致。另有 `DATABASE_POOL_MAX`（数据库连接池上限，Lambda 建议设 2）。
- **基础设施**（`infra/base/template.yaml`，us-east-2，栈名 `zyk-aws-admin-base`）：VPC（两个可用区，公有 / 应用私有 / 数据库私有子网）、NAT、RDS PostgreSQL 18（`db.t4g.micro`，单可用区）、SSH 跳板机、应用密钥和 Lambda 代码包桶。在本地手动部署，跳板机只放行部署时传入的 IP：

  ```bash
  cd infra/base
  sam validate --lint
  sam deploy --parameter-overrides SshCidr=<你的公网 IP>/32
  ```

  `SshCidr` 要填真实公网 IP：开着代理（例如 Clash 的 TUN 模式）时 `curl https://checkip.amazonaws.com` 查到的可能是代理节点的 IP。IP 变了就用新 IP 再执行一次 `sam deploy`。跳板机有固定 IP（输出 `BastionPublicIp`），sshd 同时监听 22 和 443（有些网络封了出站 22）；目前从开着 Clash TUN 的本机还连不上，待排查。数据库开了删除保护，删栈时会留快照；删栈前要先清空代码包桶。账户是 AWS 免费计划：只能用免费套餐机型（跳板机用 `t4g.micro`），费用从免费额度里扣，额度用完或到期后需要升级到付费计划。免费计划只能建 express 配置的 Aurora（不在 VPC 里），所以数据库先用 RDS，升级后可换回 Aurora Serverless v2。
- **数据库初始化**（基础栈部署后做一次）：数据库在私有子网里，在 AWS CloudShell 的 VPC 环境里操作（VPC 选基础栈的 VPC，子网选一个应用私有子网，安全组选 `LambdaSecurityGroup`）。数据库强制 TLS，证书用 `https://truststore.pki.rds.amazonaws.com/us-east-2/us-east-2-bundle.pem`。
  1. 用主账号 `zyk_admin`（密码在输出 `DbMasterSecretArn` 指向的密钥里）建应用账号 `zyk_app`，再把数据库所有者改成它：`CREATE ROLE zyk_app LOGIN PASSWORD ...; GRANT zyk_app TO zyk_admin; ALTER DATABASE zyk_aws_admin OWNER TO zyk_app;`。RDS 的主账号不是超级用户，要先把自己加进 `zyk_app` 才能改所有者。应用和迁移都用 `zyk_app`，主账号只做维护。
  2. 用 `zyk_app` 执行 `prisma migrate deploy`，连接串带 `sslmode=require&sslcert=<证书文件的绝对路径>`。CloudShell 里不用装整个仓库：单独 `npm install prisma@<pnpm-lock.yaml 里的版本>`，拷入 `packages/db/prisma`，再写一个只从 `MIGRATE_DATABASE_URL` 读连接串的 `prisma.config.ts`。
  3. 把 `DATABASE_URL`（`zyk_app`，带 `sslmode=verify-full`）和 `GITHUB_TOKEN` 写进应用密钥 `zyk-aws-admin-base/app`，保留 `BETTER_AUTH_SECRET`：先读出当前值，用 `jq` 只改这两个字段，再 `put-secret-value`。不要改模板里这个密钥的 `GenerateSecretString`，改了会重新生成整个密钥，把这两个字段清空。

  CloudShell 闲置一段时间会重置，文件和变量都会丢，要一口气做完。`read -s` 输入密码或 token 的那一行要单独粘贴，否则它会把下一行命令当成输入读走。CloudShell 的 psql 16 对 PostgreSQL 18 执行 `\l` 会报错，可以改查 `pg_database`。
- 页面和接口使用同一个域名，所以登录 Cookie 是 `SameSite=Lax`。

## Getting Started

First, install the dependencies:

```bash
pnpm install
```

## Database Setup

Generate the Prisma client before development, typechecking, or building, including in CI and deployment builds. Run this again after changing the Prisma schema:

```bash
pnpm run db:generate
```

This project uses PostgreSQL with Prisma.

1. Make sure you have a PostgreSQL database set up.
2. Update your `apps/server/.env` file with your PostgreSQL connection details. Optionally set `GITHUB_TOKEN` (a token with no scopes is enough, it only reads public profiles); without it GitHub limits search to 10 requests per minute and profile lookups to 60 per hour. The token is only used by the server.

3. Apply the migrations to your database:

```bash
pnpm -F @zyk-aws-admin/db run db:migrate:deploy
```

During development you can also use `pnpm run db:migrate` (create and apply a new migration after changing the schema) or `pnpm run db:push`.

Then, run the development server:

```bash
pnpm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the web application.
From `apps/native`, run the `ios` script for iOS or the `android` script for Android to build and launch the app. See [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/) for device setup.
The API is running at [http://localhost:3000](http://localhost:3000).

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from "@zyk-aws-admin/ui/components/button";
```

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/web`.

## Environment Configuration

Each app owns its environment schema in `.env.schema`. Varlock generates `src/env.ts` during installation; run `pnpm run env:generate` after changing a schema. Commit schemas, and keep secrets in ignored env files or your deployment platform.

Import the generated `ENV` accessor in application code. Shared database and auth packages receive configuration or initialized clients from the application. See [Varlock's monorepo guide](https://varlock.dev/guides/monorepos/).

Bun's automatic env loading is disabled in `bunfig.toml`; the framework integration or server bootstrap loads Varlock. Node deployments must include Varlock and its dependencies alongside the app schema.

Run standalone Node/Bun tools that use Varlock from the owning app directory so they load that app's schema and env files. `env:generate` only generates TypeScript files; it does not initialize environment values in a subsequent command.

## Git Hooks and Formatting

- Run checks: `pnpm run check`

## Testing

```bash
pnpm run test
```

Runs Vitest in `packages/api` and `packages/auth`. The tests need the PostgreSQL server from `DATABASE_URL`; each package creates and migrates its own `*_test` database and never touches the development database.

## Project Structure

```
zyk-aws-admin/
├── apps/
│   ├── web/         # Frontend application (Next.js)
│   ├── native/      # Mobile application (React Native, Expo)
│   └── server/      # Backend API (Hono, TRPC)
├── packages/
│   ├── ui/          # Shared shadcn/ui components and styles
│   ├── api/         # API layer / business logic (tRPC routers, GitHub client, error codes)
│   ├── auth/        # Authentication configuration & logic
│   └── db/          # Database schema & queries
├── docs/            # PRD
└── specs/           # Requirements, designs and task lists per feature
```

## Available Scripts

- `pnpm run dev`: Start all applications in development mode
- `pnpm run build`: Build all applications
- `pnpm run dev:web`: Start only the web application
- `pnpm run dev:server`: Start only the server
- `pnpm run check-types`: Check TypeScript types across all apps
- `pnpm run dev:native`: Start the React Native/Expo development server
- `pnpm run db:push`: Push schema changes to database
- `pnpm run db:generate`: Generate database client/types
- `pnpm run db:migrate`: Run database migrations
- `pnpm -F @zyk-aws-admin/db run db:migrate:deploy`: Apply existing migrations without creating new ones
- `pnpm run db:studio`: Open database studio UI
- `pnpm run check`: Run Biome formatting and linting
- `pnpm run fix`: Auto-fix formatting and lint issues
- `pnpm run test`: Run the Vitest suites

## Better Auth Schema Generation

After changing auth plugins or schema options, run `pnpm run auth:generate` from the project root. The script runs the Better Auth CLI through `varlock run` from the owning app directory, loading the auth instance from `src/services.ts`. Review the schema changes, then use your ORM's migration workflow to apply them.
