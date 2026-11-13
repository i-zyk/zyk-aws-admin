# R06 用户详情 - 任务清单

> 完成一项后把 `- [ ]` 改为 `- [✅]`

- [✅] 1. 后端 `githubUser.byId`
  - 说明：按 `id` 查记录，不存在抛 `NOT_FOUND`/`RECORD_NOT_FOUND`；单独查添加人 `{ id, name }`，查不到为 `null`
  - 对应验收标准：R06-AC1、R06-AC2、R06-AC3、R06-AC4
  - 测试：pnpm -F @zyk-aws-admin/api run test（10 文件 224 项）+ pnpm -F @zyk-aws-admin/api run check-types + pnpm run check-types + pnpm exec ultracite check packages/api/src，通过（第 1 轮）
- [✅] 2. 详情页面
  - 说明：`[id]/page.tsx` 解析 `params`（不合法直接显示记录不存在）；`github-user-detail.tsx` 复用资料卡片 + 后台信息区块；「已删除的用户」；`record-not-found.tsx`；加载中和出错状态；列表和预览的「查看」链接指向这里
  - 对应验收标准：R06-AC1 ~ R06-AC6
  - 测试：pnpm run check-types --force（7 包）+ pnpm exec ultracite check apps/web/src/app/github-users apps/web/src/lib/format-date-time.ts packages/api/src（32 文件 0 问题）+ pnpm -F @zyk-aws-admin/api run test（10 文件 224 项）+ node 直接运行 parseGithubUserIdParam 核对 13 个输入（1、42、2147483647 合法；2147483648、0、-1、1.5、abc、" 1"、1e3、0x10、01、空串为 null）+ agent-browser 登录后实测（临时账号，测后已删除）：列表「查看」进入 /github-users/4 显示资料卡片 + 后台信息（备注、标签、添加人、添加时间、最后同步时间），预览 octocat 的「查看」进入 /github-users/2，「返回列表」回到 /github-users；/github-users/abc、0、-1、1.5、1e3、2147483648 显示「记录不存在」且 byId 请求数 0，/github-users/999999 显示「记录不存在」且只请求 1 次、无 toast；模拟 createdBy=null 显示「已删除的用户」，多行备注和标签正常、HTML 被转义；阻断请求时先显示「正在加载用户详情」骨架，重试耗尽后显示「详情加载失败：Failed to fetch」+「重试」且无 toast，解除后点重试恢复；控制台无错误，通过（第 1 轮）
- [✅] 3. 编写测试（`github-user.by-id.test.ts`，测试库）
  - 说明：未登录 `UNAUTHORIZED`；存在的记录返回全部字段（日期为 ISO 字符串）和 `createdBy.name`；把 `createdById` 指向不存在的用户时 `createdBy` 为 `null`；不存在的 ID 返回 `NOT_FOUND` 且 `appCode` 为 `RECORD_NOT_FOUND`；0、负数、小数返回 `BAD_REQUEST`；调用过程中模拟的 GitHub 客户端没有被调用
  - 对应验收标准：R06-AC1 ~ R06-AC5
  - 测试：pnpm -F @zyk-aws-admin/api run test（11 文件 238 项，含 github-user.by-id.test.ts 14 项，使用测试数据库）+ pnpm -F @zyk-aws-admin/api run check-types + pnpm exec ultracite check packages/api/src（20 文件 0 问题），通过（第 1 轮）
- [✅] 4. 自测并对照 requirements.md 逐条验收
  - 说明：浏览器中从列表和预览进入详情；访问 `/github-users/999999` 和 `/github-users/abc` 看到「记录不存在」（后者 Network 无请求）；`pnpm run check`、`pnpm run check-types` 通过
  - 对应验收标准：R06-AC1 ~ R06-AC6
  - 测试：pnpm -F @zyk-aws-admin/api run test（11 文件 238 项，使用测试数据库）+ pnpm run check-types --force（7 包，无缓存）+ pnpm exec ultracite check apps/web/src/app/github-users apps/web/src/lib/format-date-time.ts packages/api/src（33 文件 0 问题；全仓 `pnpm run check` 的 50 个错误都在 R06 未改动的遗留文件里，按 R00 决策 D3 由 R11 负责）+ agent-browser 登录后实测（临时账号，测后已删除）：列表「查看」进入 /github-users/8 显示资料卡片 + 后台信息（备注、标签、添加人、添加时间、最后同步时间）；预览 ezmobius 的「查看」进入同一详情页；/github-users/abc、0、1.5 显示「记录不存在」+「返回列表」且 byId 请求数 0；/github-users/999999 显示「记录不存在」且只请求 1 次，通过（第 1 轮）
- CR（2026-11-11）：Codex 提出 0 条，采纳 0 条；不采纳：无（Codex 未发现可操作问题，web/api 类型检查与变更文件 lint 通过；其注明的数据库集成测试因环境只读未运行属审查说明，非问题，交 W6R 回归测试覆盖）
