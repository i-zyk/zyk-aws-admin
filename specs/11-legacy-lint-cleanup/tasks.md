# R11 清理遗留 lint - 任务清单

> 完成一项后把 `- [ ]` 改为 `- [✅]`

- [ ] 1. 盘点当前问题
  - 说明：执行 `pnpm exec biome check --max-diagnostics=500`，按文件和规则整理清单，更新 design.md 的表格；先确认 requirements.md「待确认问题」中 `.workflow/state.json` 的处理方式
  - 对应验收标准：R11-AC1
- [ ] 2. 配置类问题
  - 说明：`apps/fumadocs/biome.json` 的 `$schema` 升级到与根目录 Biome 一致的版本，弃用字段改成新写法；`packages/ui/src/lib/utils.ts` 只对该文件关闭 `noBarrelFile` 并写明原因（shadcn 约定，不重构）
  - 对应验收标准：R11-AC2、R11-AC3
- [ ] 3. 按规则修复其余问题
  - 说明：先 `pnpm exec ultracite fix`，再逐条手动修复 `apps/web`、`apps/native`、`apps/server`、`apps/fumadocs`、`packages/ui`、`packages/auth` 中剩余问题；不用 `biome-ignore`，不在根 `biome.json` 排除目录或关规则
  - 对应验收标准：R11-AC1、R11-AC4
- [ ] 4. 自测并对照 requirements.md 逐条验收
  - 说明：全仓 `pnpm run check` 0 错误；`pnpm run check-types`、`pnpm run test` 通过；浏览器中确认登录/注册切换、主题切换、表单提交正常，启动 server 确认环境变量加载正常
  - 对应验收标准：R11-AC1 ~ R11-AC5
