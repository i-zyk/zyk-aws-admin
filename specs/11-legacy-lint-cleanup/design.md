# R11 清理遗留 lint - 技术设计

> 技术参考：[AGENTS.md](../../AGENTS.md)　需求：[requirements.md](requirements.md)

## 技术约定

- 先 `pnpm exec ultracite fix` 处理能自动修复的问题，再逐条手动修复剩下的（AGENTS.md「Quick Reference」）
- 不在根目录 `biome.json` 整体排除目录或关闭规则；唯一例外是 `packages/ui/src/lib/utils.ts` 的 `noBarrelFile`（用户已确认）
- 修复只改写法，不改行为

## 方案概述

开工时先执行 `pnpm exec biome check --max-diagnostics=500` 拿到当时的完整清单，按文件分组处理。以下是 R00 时（基线 `907bf5b`）的清单和处理思路，作为参考：

| 文件 | 问题 | 处理 |
| --- | --- | --- |
| `apps/fumadocs/biome.json` | `$schema` 为 2.2.0，与 CLI 2.5.15 不符；`linter.rules.recommended` 已弃用 | `$schema` 改为 `https://biomejs.dev/schemas/2.5.15/schema.json`（或 `biome migrate` 后核对）；`recommended: true` 改为 `preset: "recommended"` |
| `packages/ui/src/lib/utils.ts` | `noBarrelFile` | shadcn 约定写法，不重构；文件顶部加 `// biome-ignore lint/performance/noBarrelFile: shadcn 约定的 cn 导出入口` |
| `apps/web/src/app/login/page.tsx`、`sign-in-form.tsx`、`sign-up-form.tsx`、`mode-toggle.tsx`、`user-menu.tsx` | `noJsxPropsBind` | 把内联箭头函数提到组件外或用 `useCallback`；R01 重写后以实际剩余为准 |
| `apps/web/src/app/page.tsx` | `noNestedTernary`、`noUnnecessaryConditions` | 拆成提前返回或具名布尔变量 |
| `apps/web/src/app/dashboard/dashboard.tsx` | `noUselessFragments`、`noUnusedFunctionParameters` | 去掉多余 Fragment、删除或用 `_` 前缀标记未用参数 |
| `apps/web/src/lib/auth-client.ts` | `noNonNullAssertion` | 用类型收窄或带报错的取值替代 `!` |
| `apps/server/src/env.server.ts` | `noBarrelFile` | 改为先导入再导出的普通模块写法，或让调用方直接从 `./env` 导入并在入口保留 `varlock/auto-load` 副作用导入；保证 `ENV` 在被读取前已加载 |
| `apps/native/**`（`modal.tsx`、`sign-in.tsx`、`sign-up.tsx`、`theme-toggle.tsx`、`app-theme-context.tsx`、`auth-client.ts`、`utils/trpc.ts`） | `noJsxPropsBind`、`noUnnecessaryConditions`、`noNamespaceImport`、`useConsistentTypeDefinitions`、`noParametersOnlyUsedInRecursion` | 按规则逐条修复 |
| `packages/auth/src/index.ts`、`packages/ui/src/components/*`（`input-group.tsx`、`label.tsx`、`message-scroller.tsx`） | 类型定义风格、a11y、`noExportedImports` | 按规则修复；a11y 问题用语义元素和键盘事件修复，不加忽略注释 |
| `apps/fumadocs/src/**` | `noImportantStyles`、`noUnusedImports` | 按规则修复 |
| `.workflow/state.json` | 格式 | 见 requirements.md「待确认问题」，开工时先确认 |

## 涉及模块 / 文件

以开工时 `pnpm run check` 的实际结果为准，预计涉及 `apps/web`、`apps/native`、`apps/server`、`apps/fumadocs`、`packages/ui`、`packages/auth` 中的脚手架文件。

## 数据模型

无变化。

## 接口设计

无变化。

## 风险

- `packages/ui` 是 shadcn 生成的组件，修复 a11y 问题时注意不要破坏组件对外的 props 和样式。
- `env.server.ts` 的加载顺序影响环境变量读取，改完要实际启动一次 server 确认。
