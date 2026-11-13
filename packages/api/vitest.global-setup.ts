import { prepareTestDatabase } from "@zyk-aws-admin/db/testing";
import type { TestProject } from "vitest/node";

declare module "vitest" {
	export interface ProvidedContext {
		testDatabaseUrl: string;
	}
}

export default async function setup(project: TestProject): Promise<void> {
	const testDatabaseUrl = await prepareTestDatabase(process.env.DATABASE_URL);
	project.provide("testDatabaseUrl", testDatabaseUrl);
}
