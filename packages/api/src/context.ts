import type { Session } from "@zyk-aws-admin/auth";
import type { Database } from "@zyk-aws-admin/db";

export type Context = {
	session: Session | null;
	db: Database;
};
