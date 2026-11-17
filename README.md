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
- **后端**：`apps/server` 部署到 AWS Lambda（API Gateway HTTP API，IAM 鉴权），用 AWS SAM 管理；浏览器只访问 `admin.izyk.online`，由 Cloudflare Worker 签名后转发过去（见下文「Worker 转发」）。
  - Lambda 入口是 `src/lambda.ts`，本地 Node 入口是 `src/index.ts`，两者共用 `src/app.ts`。
  - `pnpm -F server run build:lambda` 把所有依赖打进 `apps/server/dist-lambda/`（Handler：`index.handler`），部署时不需要 `node_modules`。打包前先 `pnpm run db:generate`。
  - Lambda 上没有 `.env` 和 varlock CLI，环境变量由 `src/lambda-env.ts` 用 zod 校验，规则和 `apps/server/.env.schema` 保持一致。另有 `DATABASE_POOL_MAX`（数据库连接池上限，Lambda 建议设 2）。
- **基础设施**（`infra/base/template.yaml`，us-east-2，栈名 `zyk-aws-admin-base`）：VPC（两个可用区，公有 / 应用私有 / 数据库私有子网）、NAT、RDS PostgreSQL 18（`db.t4g.micro`，单可用区）、SSH 跳板机、应用密钥和 Lambda 代码包桶。在本地手动部署：

  ```bash
  cd infra/base
  sam validate --lint
  sam deploy
  ```

  数据库开了删除保护，删栈时会留快照；删栈前要先清空代码包桶。账户是 AWS 免费计划：只能用免费套餐机型（跳板机用 `t4g.micro`），费用从免费额度里扣，额度用完或到期后需要升级到付费计划。免费计划只能建 express 配置的 Aurora（不在 VPC 里），所以数据库先用 RDS，升级后可换回 Aurora Serverless v2。
- **登录跳板机**：跳板机不对公网开放任何端口，SSH 经 EC2 Instance Connect Endpoint（输出 `InstanceConnectEndpointId`）走 AWS API 的 HTTPS 隧道，不需要放行本机 IP，开着代理也能用。`~/.ssh/config` 里加：

  ```
  Host zyk-bastion
    HostName <输出 BastionInstanceId>
    User ec2-user
    IdentityFile ~/.ssh/izyk.pem
    ProxyCommand aws ec2-instance-connect open-tunnel --instance-id %h --profile zyk-iam --region us-east-2
  ```

  之后 `ssh zyk-bastion` 登录（跳板机上装了 psql）。从本机连数据库：`ssh -N -L 15432:<输出 DbEndpoint>:5432 zyk-bastion`，窗口开着时本机 `localhost:15432` 就是线上数据库，连接串用 `sslmode=require`（主机名是 localhost，`verify-full` 校验不过）。
- **数据库初始化**（基础栈部署后做一次）：数据库在私有子网里，可以用上面的端口转发在本机操作，或者在 AWS CloudShell 的 VPC 环境里操作（VPC 选基础栈的 VPC，子网选一个应用私有子网，安全组选 `LambdaSecurityGroup`）。数据库强制 TLS，证书用 `https://truststore.pki.rds.amazonaws.com/us-east-2/us-east-2-bundle.pem`。
  1. 用主账号 `zyk_admin`（密码在输出 `DbMasterSecretArn` 指向的密钥里）建应用账号 `zyk_app`，再把数据库所有者改成它：`CREATE ROLE zyk_app LOGIN PASSWORD ...; GRANT zyk_app TO zyk_admin; ALTER DATABASE zyk_aws_admin OWNER TO zyk_app;`。RDS 的主账号不是超级用户，要先把自己加进 `zyk_app` 才能改所有者。应用和迁移都用 `zyk_app`，主账号只做维护。
  2. 用 `zyk_app` 执行 `prisma migrate deploy`，连接串带 `sslmode=require&sslcert=<证书文件的绝对路径>`。CloudShell 里不用装整个仓库：单独 `npm install prisma@<pnpm-lock.yaml 里的版本>`，拷入 `packages/db/prisma`，再写一个只从 `MIGRATE_DATABASE_URL` 读连接串的 `prisma.config.ts`。
  3. 把 `DATABASE_URL`（`zyk_app`，带 `sslmode=verify-full`）和 `GITHUB_TOKEN` 写进应用密钥 `zyk-aws-admin-base/app`，保留 `BETTER_AUTH_SECRET`：先读出当前值，用 `jq` 只改这两个字段，再 `put-secret-value`。不要改模板里这个密钥的 `GenerateSecretString`，改了会重新生成整个密钥，把这两个字段清空。

  CloudShell 闲置一段时间会重置，文件和变量都会丢，要一口气做完。`read -s` 输入密码或 token 的那一行要单独粘贴，否则它会把下一行命令当成输入读走。CloudShell 的 psql 16 对 PostgreSQL 18 执行 `\l` 会报错，可以改查 `pg_database`。
- **应用栈**（`infra/api/template.yaml`，栈名 `zyk-aws-admin-api`）：后端 Lambda（Node 24、arm64、1024 MB、并发上限 10）放在应用私有子网，前面是 HTTP API，只接受 SigV4 签名的请求（`AWS_IAM` 鉴权，没签名返回 403），限速每秒 20 个、突发 50。推送到 main 时由 `.github/workflows/deploy-server.yml` 部署（见下文「后端 CI」）；第一次部署或排查问题时在本地部署（先部署 CI 栈，应用栈要引用它的权限边界）：

  ```bash
  pnpm run db:generate && pnpm -F server run build:lambda && pnpm -F server run build:migrate
  cd infra/api
  sam validate --lint
  sam deploy --parameter-overrides MigrationsHash=$(git rev-parse HEAD:packages/db/prisma/migrations)
  ```

  - 密钥（`BETTER_AUTH_SECRET`、`DATABASE_URL`、`GITHUB_TOKEN`）在部署时从应用密钥 `zyk-aws-admin-base/app` 读取，写进 Lambda 的环境变量：有权限查看 Lambda 配置的人能在控制台看到明文。
  - 修改应用密钥后要重新部署并把 `SecretRevision` 加 1（`sam deploy --parameter-overrides SecretRevision=2`），否则 CloudFormation 不会重新读取，函数还在用旧值。
  - 输出 `ApiEndpoint` 是接口地址（写在 `apps/web/wrangler.jsonc` 的 `BACKEND_URL`），`WorkerUserName` 是 Worker 签名用的 IAM 用户（只能调用这个接口）。本地测试可以用 curl 自带的签名：`curl --aws-sigv4 "aws:amz:us-east-2:execute-api" --user "$AWS_ACCESS_KEY_ID:$AWS_SECRET_ACCESS_KEY" <ApiEndpoint>/`，返回 `OK`。
  - **数据库迁移**：部署时 CloudFormation 先调用迁移函数（自定义资源 `Migrations`），迁移成功才更新 API 函数；迁移失败整个部署回滚，线上继续跑旧代码。`MigrationsHash`（迁移目录的 git 树哈希）变了才会触发迁移。迁移函数（`apps/server/src/migrate-lambda.ts`）在 VPC 里，用 `packages/db/src/migrate.ts` 执行，和 `prisma migrate deploy` 兼容：同一张 `_prisma_migrations` 表、同样的校验和，`migrate.test.ts` 对照真正的 Prisma 验证，升级 Prisma 后要能通过。已上线的迁移文件不能再改（校验和不一致会报错停下）；某个迁移失败后要先修复数据库并用 `prisma migrate resolve` 标记，才能继续部署。手动补跑：`aws lambda invoke --function-name <输出 MigrateFunctionName> out.json`。
- **后端 CI**（`infra/ci/template.yaml`，栈名 `zyk-aws-admin-ci`，本地手动部署）：账户的 SCP 禁止创建 OIDC 身份提供商，GitHub Actions 只能用长期访问密钥，所以权限分三层：
  - 部署用户 `DeployUser`：密钥存在 GitHub `production` 环境（只允许 main 分支）的 secrets `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`。它只能对应用栈生成和执行变更集、往代码包桶上传，以及把服务角色交给 CloudFormation。
  - CloudFormation 服务角色 `CloudFormationRole`（`production` 环境变量 `AWS_CFN_ROLE_ARN`）：真正创建应用栈资源，限定在应用栈的资源类型和名称前缀；CI 部署过一次后，应用栈会记住这个角色，之后本地部署也用它。
  - 权限边界 `AppBoundary`：服务角色只能创建或修改挂了它的 IAM 角色和用户，应用栈里的角色和用户都挂着它。部署密钥泄露时，攻击者能做的事超不出这个边界（写日志、Lambda 在 VPC 里建网卡、调用 API）。
  - 工作流：Biome、类型检查、测试（PostgreSQL 18 容器）→ 打包两个函数 → `sam deploy --config-env ci --role-arn ...` → 经 `admin.izyk.online` 冒烟测试。基础栈和 CI 栈不进 CI。
  - 换部署密钥：`aws iam create-access-key --user-name <输出 DeployUserName>`，用管道把两个值分别写进 `gh secret set AWS_ACCESS_KEY_ID --env production` 和 `gh secret set AWS_SECRET_ACCESS_KEY --env production`（做法和下文 Worker 密钥一样），再删掉旧密钥。
- 模板里会上传到 AWS 的文字（栈说明、参数说明、输出说明、资源 `Metadata`）用英文，中文在 CloudFormation 里会变成 `???`；中文说明写在 `#` 注释里。
- **Worker 转发**：`apps/web/worker.ts` 是 Worker 的自定义入口，`/api/auth/*` 和 `/trpc/*` 由 `src/lib/backend-proxy.ts` 签名（SigV4）后转发给 `BACKEND_URL`，其他路径交给 OpenNext 生成的 Next.js。服务端渲染检查登录（`src/lib/require-session.ts`）也直接签名调用后端，不请求自己的域名；本地 `next dev` 不经过这些，仍直连 `NEXT_PUBLIC_SERVER_URL`。
  - 只转发 `accept`、`content-type`、`cookie`、`origin`、`user-agent` 五个请求头，`x-client-ip` 总是用 Cloudflare 的 `CF-Connecting-IP` 覆盖（后端登录限流按它计数）。
  - 签名用的访问密钥是 Worker secrets `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`，部署时不会被覆盖。生成或更换（先在 `apps/web` 下 `npx wrangler login`；`<用户名>` 是应用栈输出 `WorkerUserName`）：

    ```bash
    KEY_JSON=$(aws iam create-access-key --user-name <用户名> --output json)
    jq -r .AccessKey.AccessKeyId <<<"$KEY_JSON" | npx wrangler secret put AWS_ACCESS_KEY_ID --name zyk-aws-admin-web
    jq -r .AccessKey.SecretAccessKey <<<"$KEY_JSON" | npx wrangler secret put AWS_SECRET_ACCESS_KEY --name zyk-aws-admin-web
    unset KEY_JSON
    ```

    换新密钥后用 `aws iam delete-access-key` 删掉旧的（一个 IAM 用户最多两个密钥）。密钥泄露时也这样处理：拿到它的人只能像 Worker 一样调用接口，但能伪造 `x-client-ip` 绕过登录限流。
  - 本地构建（`pnpm -F web run cf:build`）要能访问 Google Fonts，开着代理时设 `HTTPS_PROXY`。
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
