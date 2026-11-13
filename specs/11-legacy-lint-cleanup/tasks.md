# R11 清理遗留 lint - 任务清单

> 完成一项后把 `- [ ]` 改为 `- [✅]`

- [✅] 1. 盘点当前问题
  - 说明：执行 `pnpm exec biome check --max-diagnostics=500`，按文件和规则整理清单，更新 design.md 的表格；先确认 requirements.md「待确认问题」中 `.workflow/state.json` 的处理方式
  - 对应验收标准：R11-AC1
  - 测试：`pnpm exec biome check --max-diagnostics=500`（49 错误 / 3 警告 / 2 提示，按文件和规则统计与 design.md 清单逐项一致，`.workflow/` 已不再被检查）+ `pnpm exec biome check biome.json`（无问题），通过（第 1 轮）
- [✅] 2. 配置类问题
  - 说明：`apps/fumadocs/biome.json` 的 `$schema` 升级到与根目录 Biome 一致的版本，弃用字段改成新写法；`packages/ui/src/lib/utils.ts` 只对该文件关闭 `noBarrelFile` 并写明原因（shadcn 约定，不重构）
  - 对应验收标准：R11-AC2、R11-AC3
  - 测试：`pnpm exec biome check apps/fumadocs/biome.json packages/ui/src/lib/utils.ts`（无问题）+ `pnpm exec biome check apps/fumadocs`（不再有 deserialize 提示）+ `pnpm exec biome check --max-diagnostics=500`（48 错误 / 3 警告 / 0 提示，较任务 1 少 1 错误 2 提示）+ `pnpm exec turbo run check-types --filter web --filter @zyk-aws-admin/ui`（通过），通过（第 1 轮）
- [✅] 3. 按规则修复其余问题
  - 说明：先 `pnpm exec ultracite fix`，再逐条手动修复 `apps/web`、`apps/native`、`apps/server`、`apps/fumadocs`、`packages/ui`、`packages/auth` 中剩余问题；不用 `biome-ignore`，不在根 `biome.json` 排除目录或关规则
  - 对应验收标准：R11-AC1、R11-AC4
  - 测试：`pnpm exec biome check --max-diagnostics=500` + `pnpm run check`（183 个文件，0 错误 / 0 警告 / 0 提示）+ `pnpm exec turbo run check-types --filter web --filter native --filter server --filter @zyk-aws-admin/ui`（7 个任务通过）+ `pnpm -C apps/fumadocs run types:check`（通过）+ `pnpm -F server run build`（通过）+ 新进程经 `env.server.ts` 读取 `ENV`（NODE_ENV/BETTER_AUTH_URL/CORS_ORIGIN/DATABASE_URL 已加载，SECRET ≥ 32 位）+ 改动后重启的 dev server `GET /` 返回 OK、`/api/auth/get-session` 返回 200 + web dev `/login` 200、Next MCP `get_errors` 无错误，通过（第 1 轮）
- [✅] 4. 自测并对照 requirements.md 逐条验收
  - 说明：全仓 `pnpm run check` 0 错误；`pnpm run check-types`、`pnpm run test` 通过；浏览器中确认登录/注册切换、主题切换、表单提交正常，启动 server 确认环境变量加载正常
  - 对应验收标准：R11-AC1 ~ R11-AC5
  - 测试：`pnpm run check`（183 个文件，无问题）+ `pnpm run check-types`（7 个任务通过）+ `pnpm -C apps/fumadocs run types:check`（通过）+ `pnpm run test`（api 15 文件 / 338 测试、auth 1 文件 / 7 测试全部通过）+ agent-browser 打开 web `/login`：注册/登录表单来回切换正常、空表单提交显示「邮箱格式不正确 / 密码至少 8 位」、错误账号提交弹出「Invalid email or password」、主题菜单切换 Light/Dark 后 `html` class 与 localStorage 同步，Next MCP `get_errors` 无错误 + 新进程经 `env.server.ts` 读取 `ENV`（NODE_ENV/BETTER_AUTH_URL/CORS_ORIGIN/DATABASE_URL 已加载，SECRET ≥ 32 位）+ 改动后启动的 server `GET /` 返回 OK、`/api/auth/get-session` 返回 200；native 由 tsc 和 lint 覆盖（`expo export` 在加载 `metro.config.js` 时报 `require is not defined in ES module scope`，原因是根 `package.json` 从初始提交起就有 `"type": "module"`，与本需求无关；该根因判断有误，已在 W7b 验收时更正，真实原因见 requirements.md D3，由任务 5 修复），通过（第 1 轮）
- [✅] 5. 修复 native metro 配置并补 native 运行时验证
  - 说明：按 requirements.md「已确认决策」D3（用户改选 C），用 `git mv` 把 `apps/native/metro.config.js` 改名为 `apps/native/metro.config.cjs`，第一行加 `"use strict";`，`import.meta.dirname` 改为 `__dirname`，其余不变；检查仓库里按文件名引用 `metro.config.js` 的地方（biome.json、tsconfig、eas、文档）一并改；确认 `require` 该配置能拿到 resolver/serializer/transformer 等、`pnpm exec biome check apps/native/metro.config.cjs` 无报错、全仓 `pnpm run check` 仍为 0 错误；然后让 native 能打包，在 Expo web（或模拟器）里实测登录/注册切换、主题切换和表单提交，作为 R11-AC5 native 部分的运行时证据
  - 对应验收标准：R11-AC1、R11-AC5
  - 测试：`pnpm exec biome check apps/native/metro.config.cjs biome.json`（无问题）+ `pnpm run check`（183 个文件，无问题，跑过 Expo 后复查仍为 0）+ `pnpm exec turbo run check-types --filter native --force`（4 个任务通过）+ `node -e 'require("./metro.config.cjs")'`（拿到 resolver/serializer/transformer/projectRoot 等 16 个键）+ `expo export --platform web`（打包成功，11 个静态路由）+ `expo start --web` 后用 agent-browser 实测（认证接口用 `network route --allow-origin` mock，不改 server）：主题按钮 light↔dark 切换 `html` class 同步；登录提交发出 `POST /api/auth/sign-in/email`，弹出「Signed in successfully」并显示 Welcome 卡片；Sign Out 发出 `POST /api/auth/sign-out` 后登录/注册表单重新出现；注册提交发出 `POST /api/auth/sign-up/email`，弹出「Account created successfully」，通过（第 1 轮）
- CR（2026-11-12）：Codex 提出 0 条，采纳 0 条；不采纳：无
- CR（2026-11-12）：Codex 提出 0 条，采纳 0 条；不采纳：无
