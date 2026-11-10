# R06 用户详情 - 任务清单

> 完成一项后把 `- [ ]` 改为 `- [✅]`

- [ ] 1. 后端 `githubUser.byId`
  - 说明：按 `id` 查记录，不存在抛 `NOT_FOUND`/`RECORD_NOT_FOUND`；单独查添加人 `{ id, name }`，查不到为 `null`
  - 对应验收标准：R06-AC1、R06-AC2、R06-AC3、R06-AC4
- [ ] 2. 详情页面
  - 说明：`[id]/page.tsx` 解析 `params`（不合法直接显示记录不存在）；`github-user-detail.tsx` 复用资料卡片 + 后台信息区块；「已删除的用户」；`record-not-found.tsx`；加载中和出错状态；列表和预览的「查看」链接指向这里
  - 对应验收标准：R06-AC1 ~ R06-AC6
- [ ] 3. 编写测试（`github-user.by-id.test.ts`，测试库）
  - 说明：未登录 `UNAUTHORIZED`；存在的记录返回全部字段（日期为 ISO 字符串）和 `createdBy.name`；把 `createdById` 指向不存在的用户时 `createdBy` 为 `null`；不存在的 ID 返回 `NOT_FOUND` 且 `appCode` 为 `RECORD_NOT_FOUND`；0、负数、小数返回 `BAD_REQUEST`；调用过程中模拟的 GitHub 客户端没有被调用
  - 对应验收标准：R06-AC1 ~ R06-AC5
- [ ] 4. 自测并对照 requirements.md 逐条验收
  - 说明：浏览器中从列表和预览进入详情；访问 `/github-users/999999` 和 `/github-users/abc` 看到「记录不存在」（后者 Network 无请求）；`pnpm run check`、`pnpm run check-types` 通过
  - 对应验收标准：R06-AC1 ~ R06-AC6
