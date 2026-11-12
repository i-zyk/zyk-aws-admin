# 需求总览

> 需求来源：[docs/需求.md](../docs/需求.md)（v0.3）　技术参考：[AGENTS.md](../AGENTS.md)　生成日期：2026-11-10
>
> 一个需求的 tasks.md 全部完成后，把下表中该需求的状态改为 `- [✅]`
>
> 编号说明：R01～R10 与 PRD 的 REQ-01～REQ-10 一一对应；R00 是 PRD 第 5、6、8 节和里程碑 M1 中的公共基础设施，单独作为一个需求，排在最前面。R11 是 R00 验收时新增的收尾需求（见 [R00「已确认决策」D3](00-foundation/requirements.md)），清理基线 `907bf5b` 就存在的 lint 问题，依赖其他所有需求，排在最后。

| 序号 | 需求 | 依赖 | 状态 |
|------|------|------|------|
| R00 | [基础设施：数据模型、GitHub 客户端、错误码、测试框架](00-foundation/requirements.md) | 无 | - [✅] |
| R01 | [注册与登录（开放注册 + 限流 + 登录跳转）](01-auth-access/requirements.md) | R00 | - [✅] |
| R02 | [模糊搜索 GitHub 用户](02-github-search/requirements.md) | R00、R01 | - [✅] |
| R03 | [查看 GitHub 用户资料](03-github-lookup/requirements.md) | R00、R01、R02 | - [✅] |
| R04 | [加入数据库](04-add-github-user/requirements.md) | R03 | - [✅] |
| R05 | [名单列表](05-github-user-list/requirements.md) | R04 | - [✅] |
| R06 | [用户详情](06-github-user-detail/requirements.md) | R03、R05 | - [✅] |
| R07 | [修改备注和标签](07-github-user-edit/requirements.md) | R05、R06 | - [ ] |
| R08 | [从 GitHub 同步](08-github-user-sync/requirements.md) | R05、R06 | - [ ] |
| R09 | [删除（物理删除）](09-github-user-delete/requirements.md) | R05、R06 | - [ ] |
| R10 | [批量删除（P1）](10-github-user-bulk-delete/requirements.md) | R09 | - [ ] |
| R11 | [清理遗留 lint](11-legacy-lint-cleanup/requirements.md) | R00～R10 全部 | - [ ] |

## 建议开发顺序

1. R00 基础设施（数据模型和迁移、Vitest、GitHub 客户端、错误码、上下文和环境变量）
2. R01 注册与登录
3. R02 模糊搜索 GitHub 用户
4. R03 查看 GitHub 用户资料
5. R04 加入数据库
6. R05 名单列表
7. R06 用户详情
8. R07 修改备注和标签
9. R08 从 GitHub 同步
10. R09 删除
11. R10 批量删除（P1，本期尽量做）
12. R11 清理遗留 lint（排在所有功能之后、W8 交付之前；全仓 `pnpm run check` 0 错误）

## 不在本期范围

- 生产部署（PRD 决策 D4，功能完成后另行讨论）
- 移动端 `apps/native` 接入、仓库/提交/组织数据、定时同步、多角色权限（PRD 2.2 节）
