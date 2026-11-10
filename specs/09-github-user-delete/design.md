# R09 删除（物理删除） - 技术设计

> 技术参考：[AGENTS.md](../../AGENTS.md)　需求：[docs/需求.md](../../docs/需求.md) REQ-09、第 5 节、第 7 节

## 技术约定

- 接口加在 `githubUserRouter`，`protectedProcedure` + Zod 输入（AGENTS.md「架构与数据流」·tRPC）
- 共享 UI 组件用 shadcn 添加到 `packages/ui`（AGENTS.md「注意事项」）
- 增删改错误在各自的地方处理（PRD 6.4）

## 方案概述

- **`githubUser.delete({ id })`**：`ctx.db.githubUser.delete({ where: { id }, select: { id: true } })`，捕获 `P2025` → `NOT_FOUND` / `RECORD_NOT_FOUND`。物理删除，没有 `deletedAt`（PRD 第 5 节、D2）。返回 `{ id }`。
- **确认框** `apps/web/src/components/github-users/delete-github-user-dialog.tsx`：shadcn `AlertDialog`，标题「删除 <login>？」，正文「删除后无法恢复，备注和标签会一起删除」，按钮「取消」「删除」。只有点「删除」才调用 mutation；进行中禁用按钮。
  - 成功：`toast.success("已删除")`，让 `list`、`tags`、`byId`、`lookup`、`search` 失效（预览和搜索结果里的「已在名单中」会消失）；在详情页时 `router.push("/github-users")`。
  - `RECORD_NOT_FOUND`：`toast.error("记录不存在")`，同样让 `list` 失效刷新；在详情页时回到列表。
- 列表行和详情页共用这个确认框组件。

## 涉及模块 / 文件

| 文件 | 改动 |
| --- | --- |
| `packages/api/src/routers/github-user.ts` | 新增 `delete` |
| `packages/api/src/routers/github-user.delete.test.ts` | 新增测试 |
| `packages/ui/src/components/` | `npx shadcn@latest add alert-dialog -c packages/ui` |
| `apps/web/src/components/github-users/delete-github-user-dialog.tsx` | 新增 |
| `apps/web/src/app/github-users/[id]/github-user-detail.tsx` | 加「删除」按钮 |
| `apps/web/src/app/github-users/github-user-list.tsx` | 操作列加「删除」按钮 |

## 数据模型

无变化（物理删除，`githubId` 唯一约束删除后立即释放）。

## 接口设计

```ts
githubUser.delete: protectedProcedure
  .input(z.object({ id: z.number().int().positive() }))
  .mutation(...) => { id: number }
```

错误：`NOT_FOUND`（`RECORD_NOT_FOUND`）、`BAD_REQUEST`、`UNAUTHORIZED`。

## 关键流程

```mermaid
flowchart TD
  A[点击「删除」] --> B["AlertDialog：删除 login？<br>删除后无法恢复，备注和标签会一起删除"]
  B -->|取消| C[关闭，不发请求]
  B -->|删除| D[githubUser.delete]
  D -->|成功| E["toast「已删除」，失效列表等查询<br>详情页回到列表"]
  D -->|NOT_FOUND| F["toast「记录不存在」，刷新列表"]
```

## 异常与边界情况

- 两个会话同时删除同一条：后到的返回 `RECORD_NOT_FOUND`，前端按 R09-AC4 处理。
- 删除当前列表页的最后一条：列表刷新后该页为空时，前端把页码减 1（技术参考未规定，暂按此）。

## 风险与取舍

- 物理删除不可恢复（D2 已确认）：靠确认框明确提示降低误删。
- 新增 shadcn 组件 `alert-dialog`：PRD 6.4 已列出。
