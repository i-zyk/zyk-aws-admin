// 详情页 URL 中的记录 ID（R06）：只接受十进制正整数写法，不在 Int 范围内的一律视为不存在。
// 服务端 page.tsx 使用，只依赖共享 schemas。
import { githubUserIdSchema } from "@zyk-aws-admin/api/github/schemas";

/** 十进制正整数，不带前导 0；排除 z.coerce 会接受的 " 1"、"1e3"、"0x10" 等写法 */
const ID_PARAM_PATTERN = /^[1-9]\d*$/;

/** 解析 `/github-users/[id]` 的 id；不合法时返回 null（页面直接显示「记录不存在」，不发请求） */
export function parseGithubUserIdParam(raw: string): number | null {
	if (!ID_PARAM_PATTERN.test(raw)) {
		return null;
	}
	const parsed = githubUserIdSchema.safeParse(Number(raw));
	return parsed.success ? parsed.data : null;
}
