import { createAuth } from "@zyk-aws-admin/auth";
import { createPrismaClient } from "@zyk-aws-admin/db";

import { ENV } from "./env.server";

export const db = createPrismaClient(ENV);
export const auth = createAuth(ENV, db);
