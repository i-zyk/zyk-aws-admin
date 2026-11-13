# R11 清理遗留 lint - 技术设计

> 技术参考：[AGENTS.md](../../AGENTS.md)　需求：[requirements.md](requirements.md)

## 技术约定

- 先 `pnpm exec ultracite fix` 处理能自动修复的问题，再逐条手动修复剩下的（AGENTS.md「Quick Reference」）
- 不在根目录 `biome.json` 整体排除目录或关闭规则；唯一例外是 `packages/ui/src/lib/utils.ts` 的 `noBarrelFile`（用户已确认）
- 修复只改写法，不改行为

## 方案概述

开工时先执行 `pnpm exec biome check --max-diagnostics=500` 拿到当时的完整清单，按文件分组处理。

### 当前清单（2026-11-12，R11 任务 1 盘点，HEAD `7a7b683`）

共 50 个错误、3 个警告、2 个提示（与 R05～R10 记录的 50 个一致；比基线 `907bf5b` 的 55 个少，`apps/web/src/app/page.tsx`、`dashboard/dashboard.tsx` 已在 R01 重写中消失）。

| 文件 | 级别 | 规则（数量） | 处理 |
| --- | --- | --- | --- |
| `.workflow/state.json` | 错误 | `format`（1） | 工作流状态文件，不是项目代码；按 requirements.md「已确认决策」D1，在根 `biome.json` 的 `files.includes` 中加 `"!.workflow"` 排除整个工作流目录（R11-AC4 唯一例外）；任务 1 已加，加后剩 49 个错误、3 个警告、2 个提示 |
| `apps/fumadocs/biome.json` | 提示 | `deserialize`（2）：`$schema` 2.2.0 与 CLI 2.5.15 不符；`linter.rules.recommended` 已弃用 | `$schema` 改为 `https://biomejs.dev/schemas/2.5.15/schema.json`；`recommended: true` 改为 `preset: "recommended"`（任务 2） |
| `packages/ui/src/lib/utils.ts` | 错误 | `noBarrelFile`（1） | shadcn 约定写法，不重构；文件内 `biome-ignore lint/performance/noBarrelFile` 并写明原因（任务 2） |
| `apps/fumadocs/src/app/global.css` | 警告 | `noImportantStyles`（2） | 按规则修复（任务 3） |
| `apps/fumadocs/src/lib/source.ts` | 警告 | `noUnusedImports`（1） | 删除未用导入（任务 3） |
| `apps/server/src/env.server.ts` | 错误 | `noBarrelFile`（1） | 改为先导入再导出的普通模块写法，或让调用方直接从 `./env` 导入并在入口保留 `varlock/auto-load` 副作用导入；保证 `ENV` 在被读取前已加载（任务 3） |
| `apps/web/src/app/login/page.tsx` | 错误 | `noJsxPropsBind`（2） | 内联箭头函数提到组件外或用 `useCallback`（任务 3） |
| `apps/web/src/components/mode-toggle.tsx` | 错误 | `noJsxPropsBind`（3） | 同上 |
| `apps/web/src/components/sign-in-form.tsx` | 错误 | `noJsxPropsBind`（4） | 同上 |
| `apps/web/src/components/sign-up-form.tsx` | 错误 | `noJsxPropsBind`（5） | 同上 |
| `apps/web/src/components/user-menu.tsx` | 错误 | `noJsxPropsBind`（1） | 同上 |
| `apps/web/src/lib/auth-client.ts` | 错误 | `noNonNullAssertion`（1） | 用类型收窄或带报错的取值替代 `!` |
| `apps/native/app/(drawer)/index.tsx` | 错误 | `noUnnecessaryConditions`（4）、`noNestedTernary`（1）、`noUnusedVariables`（1）、`noJsxPropsBind`（1）、`noLeakedRender`（1） | 按规则逐条修复（任务 3） |
| `apps/native/app/modal.tsx` | 错误 | `noJsxPropsBind`（1） | 同上 |
| `apps/native/components/sign-in.tsx` | 错误 | `noJsxPropsBind`（2）、`noUnnecessaryConditions`（1） | 同上 |
| `apps/native/components/sign-up.tsx` | 错误 | `noJsxPropsBind`（3）、`noUnnecessaryConditions`（2） | 同上 |
| `apps/native/components/theme-toggle.tsx` | 错误 | `noNamespaceImport`（1）、`noJsxPropsBind`（1） | 同上 |
| `apps/native/contexts/app-theme-context.tsx` | 错误 | `useConsistentTypeDefinitions`（1） | 同上 |
| `apps/native/lib/auth-client.ts` | 错误 | `noNamespaceImport`（1） | 同上 |
| `apps/native/utils/trpc.ts` | 错误 | `noParametersOnlyUsedInRecursion`（1） | 同上 |
| `packages/ui/src/components/input-group.tsx` | 错误 | `useSemanticElements`（2）、`useKeyWithClickEvents`（1）、`noNoninteractiveElementInteractions`（1）、`noJsxPropsBind`（1） | 删除整个文件（requirements.md「已确认决策」D2：全仓无引用，用户确认删除；需要时用 shadcn CLI 重新添加） |
| `packages/ui/src/components/label.tsx` | 错误 | `noLabelWithoutControl`（1） | 同上 |
| `packages/ui/src/components/message-scroller.tsx` | 错误 | `noExportedImports`（3） | 按规则修复 |

R00 时清单里的 `packages/auth/src/index.ts` 已不再报错。

### 任务 3 实施方式（2026-11-12）

没有执行全仓 `ultracite fix`：剩余问题里能自动修复的只有 4 个，而且都是 unsafe 修复（比如把未用变量改名为 `_foregroundColor`、直接删掉 `!important`），逐条手动修复更可控。

- `apps/fumadocs/src/app/global.css`：去掉两处 `!important`。`html > body[data-scroll-locked]` 的特异性高于 react-remove-scroll 注入的 `body[data-scroll-locked]`，`--removed-body-scroll-bar-size` 不需要 `!important` 也能覆盖；`margin-right` 在对方带 `!important` 时会覆盖不了，但 fumadocs-ui 里只有 flux 布局用 react-remove-scroll，本站用的 docs/home 布局不会出现 `data-scroll-locked`，所以当前行为不变。已在 CSS 注释里写明。
- `apps/server/src/env.server.ts`：先 `import "varlock/auto-load"`，再 `import { ENV as loadedEnv } from "./env"` 并 `export const ENV = loadedEnv`，导入顺序保证先加载环境变量；调用方不用改。
- web 登录/注册表单：新建 `apps/web/src/components/auth-text-field.tsx`，包含 `AuthTextField`（标签 + 输入框 + 错误列表，渲染出的 DOM 和原来一样）和模块级的 `selectSubmitState`，两个表单共用；提交处理函数改用 `useCallback`。`login/page.tsx`、`mode-toggle.tsx`、`user-menu.tsx` 的内联函数改为 `useCallback`。
- `apps/web/src/lib/auth-client.ts`：直接去掉 `!`（`baseURL` 本来就是可选参数，运行时取到的值不变；`process.env.NEXT_PUBLIC_SERVER_URL` 保持原样写法，Next 才能在构建时内联）。
- native：`(drawer)/index.tsx` 用 `getConnectionStatus()` 把加载/连接状态合成一个枚举，文案查表、图标交给 `ConnectionStatusIcon`（消除嵌套三元和 Biome 对 `isLoading` 的误判），同时删掉未使用的 `foregroundColor`；退出登录、关闭 modal 的处理函数提到模块级；表单 `selector` 提到模块级 `selectFormStatus`，聚焦下一个输入框用参数类型带 `null` 的 `focusInput(ref)` 加 `useCallback`（Biome 推断不出 `useRef(null)` 可能为空，会误报 `?.` 多余）；`expo-secure-store` 改为具名导入，只传 expoClient 用到的 `getItem/getItemAsync/setItem/setItemAsync`（expoClient 的 storage 类型本来就是 `Pick` 这四个）；`expo-haptics` 改为具名导入；`trpc.ts` 的 `fetch` 方法改为箭头函数属性（与 web 写法一致）；`AppThemeContextType` 改为 interface。
- `packages/ui/src/components/label.tsx`：显式解构 `htmlFor` 和 `children` 再写回 `<label>`，渲染结果不变。
- `packages/ui/src/components/message-scroller.tsx`：hooks 以 `useXxxPrimitive` 别名导入，再用同名常量导出，对外导出的名字不变。
- `packages/ui/src/components/input-group.tsx`：`InputGroupAddon` 的「点击附加区域聚焦输入框」无法在不改变行为、不加忽略注释的前提下修复。按 requirements.md「已确认决策」D2（用户选 C），直接删除该文件（全仓无引用），不改其他文件；`message-scroller.tsx` 保留。

### 任务 5 实施方式（2026-11-12）

- 按 requirements.md「已确认决策」D3（用户改选 C）：`git mv apps/native/metro.config.js apps/native/metro.config.cjs`，第一行加 `"use strict";`，`getDefaultConfig(import.meta.dirname)` 改为 `getDefaultConfig(__dirname)`，其余内容不变。`.cjs` 让 Node 和 Biome 都把它当 CommonJS，`ultracite fix` 不会再把 `__dirname` 改成 `import.meta.dirname`；Expo/metro-config 会按 `.js → .cjs → .mjs → .json` 的顺序找配置文件，不用改其他配置。
- 仓库里按文件名引用 `metro.config.js` 的只有 AGENTS.md 那条经验和本需求的规格文档，biome.json、tsconfig、app.json 都没有引用，仓库里也没有 eas.json。AGENTS.md 那条经验已改成「必须是 `metro.config.cjs` + `__dirname`」。
- 运行时验证：没有 iOS 模拟器（本机没有 `xcrun simctl`），改用 Expo web（`expo start --web`，端口 8081）+ agent-browser。server 的 CORS 只放行 `CORS_ORIGIN`（web 的 3001），8081 发出的认证/tRPC 请求会被浏览器拦下（基线配置就是这样，与本需求无关），所以要验证成功路径时，用 agent-browser 的 `network route --allow-origin` 在浏览器内 mock `sign-in/sign-up/sign-out/get-session/trpc` 的响应，不改 server 配置。
- 跑过一次 Expo 之后，会在 `apps/native` 下生成 `expo-env.d.ts` 和 `uniwind-types.d.ts`（`apps/native/.gitignore` 已忽略），但根 `biome.json` 的 `vcs.useIgnoreFile` 为 `false`，Biome 仍会检查这两个文件并报 `format` 错误，导致全仓 `pnpm run check` 失败。按 requirements.md「已确认决策」D4（用户选 A），在根 `biome.json` 的 `files.includes` 中加 `"!apps/native/expo-env.d.ts"` 和 `"!apps/native/uniwind-types.d.ts"`，只排除这两个生成文件（与 `"!apps/*/src/env.ts"` 同类），不排除目录、不关闭规则。加上之后，全仓 `pnpm run check` 恢复为 183 个文件、0 问题。
- 按 D4，R11-AC5 的 native 部分不做修复前后对比：修复前 native 无法打包，没有可比的对象；R11 对 native 的改动已逐条核对，行为等价。以当前版本在 Expo web 上的实测作为运行时证据。开发中的实测结果如下（没有改 server 配置，认证和 tRPC 的响应用 agent-browser mock）：
  - `expo start --web` 正常打包，`expo export --platform web` 打包成功；`require("./metro.config.cjs")` 能拿到 resolver/serializer/transformer/projectRoot 等配置。
  - 主题：主题按钮在 light 和 dark 之间来回切换，`html` 的 class 和标题颜色同步变化。
  - 登录：填写表单后提交，发出 `POST /api/auth/sign-in/email`，弹出「Signed in successfully」，出现 Welcome 卡片，登录和注册表单隐藏。
  - 退出：点 Sign Out 发出 `POST /api/auth/sign-out`，登录和注册表单重新出现。
  - 注册：提交注册表单，发出 `POST /api/auth/sign-up/email`，弹出「Account created successfully」。
  - 其他：tRPC 返回 OK 时状态显示 LIVE 和「Connected to API」，Private Data 正常显示；在 Tabs 页打开 modal 后点 Close 能返回。
  - 空表单提交不显示错误文案。原因是 selector 读取 `state.errorMap.onSubmit`，与 R11 之前的写法完全相同（R11 只是把 selector 提到了模块级），属于原有行为，不在本需求范围内。

## 涉及模块 / 文件

以开工时 `pnpm run check` 的实际结果为准，预计涉及 `apps/web`、`apps/native`、`apps/server`、`apps/fumadocs`、`packages/ui`、`packages/auth` 中的脚手架文件。

## 数据模型

无变化。

## 接口设计

无变化。

## 风险

- `packages/ui` 是 shadcn 生成的组件，修复 a11y 问题时注意不要破坏组件对外的 props 和样式。
- `env.server.ts` 的加载顺序影响环境变量读取，改完要实际启动一次 server 确认。
