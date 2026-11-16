import { handle } from "hono/aws-lambda";

import { createApp } from "./app";
import { createServices } from "./create-services";
import { parseLambdaEnv } from "./lambda-env";

// 在初始化阶段创建，同一个 Lambda 实例的后续请求复用数据库连接池
const config = parseLambdaEnv(process.env);
const app = createApp(createServices(config), {
	corsOrigin: config.CORS_ORIGIN,
});

/** API Gateway HTTP API（payload 2.0）调用的入口 */
export const handler = handle(app);
