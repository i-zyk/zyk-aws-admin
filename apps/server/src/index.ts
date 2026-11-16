import { serve } from "@hono/node-server";

import { createApp } from "./app";
import { ENV } from "./env.server";
import { auth, db, github } from "./services";

// 本地开发和 `pnpm start` 的入口；Lambda 入口见 lambda.ts
const app = createApp({ auth, db, github }, { corsOrigin: ENV.CORS_ORIGIN });

serve(
	{
		fetch: app.fetch,
		port: 3000,
	},
	(info) => {
		console.log(`Server is running on http://localhost:${info.port}`);
	}
);
