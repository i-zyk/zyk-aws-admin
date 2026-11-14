# Android 应用

安卓端沿用 GitSpace 界面，现已接入与 Web 相同的 Hono / tRPC / Better Auth 服务。

## 已接入的流程

- 邮箱注册、登录、退出，以及启动时恢复会话。
- 未登录时保护名单、发现和详情页；会话失效后返回登录。
- 共享名单：关键字搜索、标签筛选、排序及升降序、20 条分页、下拉刷新。
- GitHub 用户搜索及分页、完整资料预览、加入名单、识别已保存用户。
- 数据库记录详情、备注和标签编辑、从 GitHub 同步、单条删除。
- 本页勾选与全选、批量删除、删除后的页码纠正。
- 个人中心显示账号信息、名单人数、标签数量；支持浅色和深色模式。

名单是所有已登录用户共享的数据，不是个人收藏。移动端不保存一份独立名单。
GitHub 请求仍由服务端完成，移动端不持有 GitHub Token。

## 本地运行

先在仓库根目录启动后端：

```sh
pnpm run db:generate
pnpm run dev:server
```

Android 官方模拟器可以用 `10.0.2.2` 访问宿主机。以下设置仅对这次启动有效，不修改 `.env`：

```sh
EXPO_PUBLIC_SERVER_URL=http://10.0.2.2:3000 pnpm -F native exec expo start --clear --go --android
```

也可以保持 `apps/native/.env` 中的 `EXPO_PUBLIC_SERVER_URL=http://localhost:3000`，使用 ADB 转发后端端口：

```sh
adb reverse tcp:3000 tcp:3000
pnpm -F native exec expo start --clear --go --android
```

模拟器重启或 ADB 连接重置后需要重新转发。实体设备使用 USB 转发，或把
`EXPO_PUBLIC_SERVER_URL` 配置为设备可访问的后端局域网 / HTTPS 地址。
更改地址后使用 `--clear` 重新启动 Expo，避免复用旧地址的打包缓存。`10.0.2.2` 只适用于 Android 官方模拟器。

## 数据和失败处理

- 名单、标签和资料来自 TanStack Query，查询数据保存在内存中。
- 返回前台时刷新查询和会话；断网后保留已加载的数据，不提供离线写入队列。
- 备注保存失败时保留草稿并显示错误，恢复连接后可再次保存。
- 写操作进行中禁用重复提交，删除操作需要确认。
- 登录成功、退出登录和会话失效时清理上一会话的查询缓存。
- GitHub 限流按后端错误码显示重试时间；搜索在提交时请求，不逐字调用 API。

## 验证命令

```sh
pnpm run check
pnpm -F native run check-types
pnpm -F native run test
pnpm -F native exec expo export --platform android --output-dir /tmp/gitspace-android-export
```

生产签名、APK/AAB 构建及商店发布仍需单独配置。
