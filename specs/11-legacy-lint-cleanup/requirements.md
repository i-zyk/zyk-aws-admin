# R11 清理遗留 lint

> 来源：R00 任务 9 验收时用户的决定（specs/00-foundation/requirements.md「已确认决策」D3）；规范：[AGENTS.md](../../AGENTS.md)「Ultracite Code Standards」

## 背景与目标

全仓 `pnpm run check`（`ultracite check`）在基线提交 `907bf5b` 就有 55 个错误（另有 3 个警告、2 个提示），全部来自脚手架代码，不属于任何功能需求的范围。R00 把 R00-AC14 的 lint 检查缩小到了自己改动过的文件，遗留问题统一放到本需求处理。

本需求排在所有功能需求（R00～R10）之后、W8 交付之前。到那时登录注册表单、首页、dashboard 已经被 R01～R10 重写，剩下的遗留问题会少很多；开工时先重新跑一遍 `pnpm run check`，以当时的实际结果为准。

## 用户故事

- 作为开发者，我希望全仓 `pnpm run check` 0 错误，以便 lint 能作为提交前的可靠闸门，不用每次手动区分「新问题」和「老问题」。

## 验收标准

- [ ] R11-AC1：在仓库根目录执行 `pnpm run check`，0 错误。
- [ ] R11-AC2：`apps/fumadocs/biome.json` 的 `$schema` 版本与根目录安装的 Biome（当前 `2.5.15`）一致，且该文件不再报配置反序列化问题（包括已弃用字段）。
- [ ] R11-AC3：`packages/ui/src/lib/utils.ts` 保持 shadcn 的约定写法 `export { cn } from "cn";`，不重构；只对这一个文件关闭 `noBarrelFile`（文件内 `biome-ignore` 注释，或根 `biome.json` 中只匹配该文件的 `overrides`），并写明原因。
- [ ] R11-AC4：其余问题按规则修复（改代码），不用 `biome-ignore` 绕过；根目录 `biome.json` 不整体排除目录、不关闭或降级规则（AC3 那一条只针对单个文件的 override 除外）。
- [ ] R11-AC5：`pnpm run check-types`、`pnpm run test` 仍然通过；修复不改变页面行为（登录/注册切换、主题切换、表单提交、native 对应页面在修复前后表现一致）。

## 不在范围内

- 功能改动、UI 重新设计
- 升级 Biome / Ultracite 版本，或修改 Ultracite 预设

## 依赖

- 依赖 R00～R10 全部完成（这些需求会重写登录注册、首页等页面，先做功能再清理，避免重复劳动）

## 待确认问题

- `.workflow/state.json`（工作流状态文件，已写进 `.git/info/exclude`，不进入提交）也被 `pnpm run check` 检查，当前报 1 个格式错误。它不是项目代码，又不能在根 `biome.json` 里整体排除目录。开工时需要用户决定处理方式，例如：让工作流按 Biome 格式（tab 缩进）写这个文件，或允许在根 `biome.json` 中只排除这一个文件。
