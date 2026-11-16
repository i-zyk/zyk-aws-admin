import type { Context as ApiContext } from "@zyk-aws-admin/api/context";
import type { Context as HonoContext } from "hono";

import type { Services } from "./create-services";

export interface CreateContextOptions {
	context: HonoContext;
	services: Services;
}

export async function createContext({
	context,
	services: { auth, db, github },
}: CreateContextOptions): Promise<ApiContext> {
	const session = await auth.api.getSession({
		headers: context.req.raw.headers,
	});
	return {
		db,
		github,
		session,
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
