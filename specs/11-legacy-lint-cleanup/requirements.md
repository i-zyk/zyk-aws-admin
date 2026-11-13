# R11 清理遗留 lint

> 来源：R00 任务 9 验收时用户的决定（specs/00-foundation/requirements.md「已确认决策」D3）；规范：[AGENTS.md](../../AGENTS.md)「Ultracite Code Standards」

## 背景与目标

全仓 `pnpm run check`（`ultracite check`）在基线提交 `907bf5b` 就有 55 个错误（另有 3 个警告、2 个提示），全部来自脚手架代码，不属于任何功能需求的范围。R00 把 R00-AC14 的 lint 检查缩小到了自己改动过的文件，遗留问题统一放到本需求处理。

本需求排在所有功能需求（R00～R10）之后、W8 交付之前。到那时登录注册表单、首页、dashboard 已经被 R01～R10 重写，剩下的遗留问题会少很多；开工时先重新跑一遍 `pnpm run check`，以当时的实际结果为准。

## 用户故事

- 作为开发者，我希望全仓 `pnpm run check` 0 错误，以便 lint 能作为提交前的可靠闸门，不用每次手动区分「新问题」和「老问题」。

## 验收标准

- [✅] R11-AC1：在仓库根目录执行 `pnpm run check`，0 错误。
- [✅] R11-AC2：`apps/fumadocs/biome.json` 的 `$schema` 版本与根目录安装的 Biome（当前 `2.5.15`）一致，且该文件不再报配置反序列化问题（包括已弃用字段）。
- [✅] R11-AC3：`packages/ui/src/lib/utils.ts` 保持 shadcn 的约定写法 `export { cn } from "cn";`，不重构；只对这一个文件关闭 `noBarrelFile`（文件内 `biome-ignore` 注释，或根 `biome.json` 中只匹配该文件的 `overrides`），并写明原因。
- [✅] R11-AC4：其余问题按规则修复（改代码），不用 `biome-ignore` 绕过；根目录 `biome.json` 不整体排除目录、不关闭或降级规则（AC3 那一条只针对单个文件的 override 除外）。
- [✅] R11-AC5：`pnpm run check-types`、`pnpm run test` 仍然通过；修复不改变页面行为（登录/注册切换、主题切换、表单提交、native 对应页面在修复前后表现一致）。

## 不在范围内

- 功能改动、UI 重新设计
- 升级 Biome / Ultracite 版本，或修改 Ultracite 预设

## 依赖

- 依赖 R00～R10 全部完成（这些需求会重写登录注册、首页等页面，先做功能再清理，避免重复劳动）

## 已确认决策

- D1（2026-11-12，用户确认，选项 B）：`.workflow/state.json`（工作流状态文件，已写进 `.git/info/exclude`，不进入提交）会被 `pnpm run check` 检查并报格式错误。用户明确同意在根 `biome.json` 的 `files.includes` 中加一行 `"!.workflow"`，排除整个工作流目录（`state.json`、`patches/`、并行开发用的 `wt/` worktree 副本都不是项目代码，与已排除的 `.agents`、`.claude` 同类）。这是 R11-AC4「根目录 `biome.json` 不整体排除目录」的唯一例外。
- D2（2026-11-12，用户确认，选项 C）：`packages/ui/src/components/input-group.tsx` 中 `InputGroupAddon` 的「点击附加区域聚焦输入框」无法在不改变行为、不加 `biome-ignore` 的前提下通过 `noNoninteractiveElementInteractions` / `useKeyWithClickEvents`。该文件是脚手架自带的 shadcn 组件，全仓无任何引用，用户明确同意直接删除这一个文件；以后需要时用 `npx shadcn@latest add input-group -c packages/ui` 重新添加。只删这一个文件，保留 `message-scroller.tsx`（它不依赖 input-group，且已无 lint 错误）。这是「不在范围内：功能改动」的唯一例外（删除的是未使用的组件，不影响任何页面）。
- D3（2026-11-12，用户确认；先选 B，后改选 C）：native 无法打包的根因不是根 `package.json` 的 `"type": "module"`（`apps/native` 有自己的 `package.json`，无 `type` 字段，Node 按最近的 `package.json` 判断），而是基线提交 `907bf5b` 的 `ultracite fix` 把 `apps/native/metro.config.js` 中的 `__dirname` 改成了 `import.meta.dirname`，文件因含 `import.meta` 被按 ES 模块解析，`module.exports` 失效，`require` 得到空对象（实测 keys `[]`）；初始提交 `0560fc9` 用 `__dirname` 可正常工作。用户最初选 B（只把 `import.meta.dirname` 改回 `__dirname`、不改文件名），但 `.js` 文件里的 `__dirname` 仍会被下一次 `ultracite fix` 改回 `import.meta.dirname`，问题会复发；用户随后改选 C，明确同意：用 `git mv` 把 `apps/native/metro.config.js` 改名为 `apps/native/metro.config.cjs`，第一行加 `"use strict";`，内容里用 `__dirname` 代替 `import.meta.dirname`，其余不变。`.cjs` 明确是 CommonJS，Biome 不会再把 `__dirname` 改掉（实测 `biome check` 无问题、无修复）；metro-config 0.87.1 的 `SEARCH_JS_EXTS` 为 `[.js, .cjs, .mjs, .json]`，支持 `.cjs`；`require` 能拿到 resolver/serializer/transformer/projectRoot 等完整配置。改名只针对这一个文件。修复后让 native 能打包，并在 Expo web（或模拟器）中实测登录/注册、主题切换和表单提交，作为 R11-AC5 native 部分的运行时证据。
- D4（2026-11-12，用户确认，选项 A）：跑过一次 Expo 后，`apps/native` 下会生成 `expo-env.d.ts`（Expo 生成）和 `uniwind-types.d.ts`（uniwind 生成，路径由 `metro.config.cjs` 的 `dtsFile` 指定）。这两个文件已被 `apps/native/.gitignore` 忽略，但根 `biome.json` 的 `vcs.useIgnoreFile` 为 `false`，Biome 仍会检查它们并报 `format` 错误，导致全仓 `pnpm run check` 失败。用户明确同意在根 `biome.json` 的 `files.includes` 中加 `"!apps/native/expo-env.d.ts"` 和 `"!apps/native/uniwind-types.d.ts"`，只排除这两个自动生成的文件，做法与现有的 `"!apps/*/src/env.ts"` 一致；不排除目录，不关闭规则。同时，用户明确同意 R11-AC5 的 native 部分不做修复前后对比：修复前的 native 根本无法打包（`metro.config.js` 加载失败），没有可比的对象；R11 对 native 的改动已经逐条核对过，确认行为等价。以当前版本在 Expo web（或模拟器）上实测登录/注册切换、主题切换和表单提交都正常，作为 AC5 native 部分的运行时证据即可。
