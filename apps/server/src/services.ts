import { createGithubClient } from "@zyk-aws-admin/api/github/client";
import { createAuth } from "@zyk-aws-admin/auth";
import { createPrismaClient } from "@zyk-aws-admin/db";

import { ENV } from "./env.server";

export const db = createPrismaClient(ENV);
export const auth = createAuth(ENV, db);
/** GitHub 客户端单例：token 只在服务端使用，不进入任何响应 */
export const github = createGithubClient({ token: ENV.GITHUB_TOKEN });
