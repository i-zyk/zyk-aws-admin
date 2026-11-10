import type { Session } from "@zyk-aws-admin/auth";
import type { Database } from "@zyk-aws-admin/db";

import type { GithubClient } from "./github/client";

// biome-ignore lint/style/useConsistentTypeDefinitions: @hono/trpc-server 的 createContext 要求返回值可赋给 Record<string, unknown>，interface 没有隐式索引签名，必须用 type
export type Context = {
	session: Session | null;
	db: Database;
	github: GithubClient;
};
