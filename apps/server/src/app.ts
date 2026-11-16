import { trpcServer } from "@hono/trpc-server";
import { appRouter } from "@zyk-aws-admin/api/routers/index";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { createContext } from "./context";
import type { Services } from "./create-services";

export interface AppOptions {
	/** 允许跨域访问的前端地址；生产环境页面和接口同域名，CORS 实际用不到，保留给本地开发 */
	corsOrigin: string;
}

/** 创建 Hono 应用：本地 Node 服务（index.ts）和 Lambda（lambda.ts）共用 */
export function createApp(services: Services, { corsOrigin }: AppOptions) {
	const app = new Hono();

	app.use(logger());
	app.use(
		"/*",
		cors({
			allowHeaders: ["Content-Type", "Authorization"],
			allowMethods: ["GET", "POST", "OPTIONS"],
			credentials: true,
			origin: corsOrigin,
		})
	);

	app.on(["POST", "GET"], "/api/auth/*", (c) =>
		services.auth.handler(c.req.raw)
	);

	app.use(
		"/trpc/*",
		trpcServer({
			createContext: (_opts, context) => createContext({ context, services }),
			endpoint: "/trpc",
			router: appRouter,
		})
	);

	app.get("/", (c) => c.text("OK"));

	return app;
}
