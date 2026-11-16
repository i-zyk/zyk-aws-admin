import { createServices } from "./create-services";
import { ENV } from "./env.server";

/**
 * 本地 Node 服务用的单例，配置来自 varlock 校验过的 .env。
 * 也是 `pnpm auth:generate` 读取的配置入口（它要求导出 auth）。
 */
export const { auth, db, github } = createServices(ENV);
