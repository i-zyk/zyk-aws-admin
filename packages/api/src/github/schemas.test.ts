import { describe, expect, it } from "vitest";

import {
	githubUsernameSchema,
	REMARK_MAX_LENGTH,
	remarkSchema,
	SEARCH_KEYWORD_MAX_LENGTH,
	searchKeywordSchema,
	TAG_MAX_LENGTH,
	TAGS_MAX_COUNT,
	tagsSchema,
} from "./schemas";

const USERNAME_MAX_LENGTH = 39;
const USERNAME_ERROR = "用户名格式不正确";
const KEYWORD_EMPTY_ERROR = "请输入搜索关键字";
const KEYWORD_TOO_LONG_ERROR = `关键字最多 ${SEARCH_KEYWORD_MAX_LENGTH} 个字符`;

const firstIssueMessage = (result: {
	error?: { issues: { message: string }[] };
}): string | undefined => result.error?.issues[0]?.message;

describe("githubUsernameSchema", () => {
	it.each([
		["1 个字符", "a"],
		["39 个字符", "a".repeat(USERNAME_MAX_LENGTH)],
		["39 个字符且中间带 -", `${"a".repeat(19)}-${"b".repeat(19)}`],
		["字母、数字和单个 -", "octo-cat-2026"],
		["大写字母", "OctoCat"],
		["纯数字", "12345"],
	])("合法：%s", (_label, username) => {
		expect(githubUsernameSchema.safeParse(username)).toEqual({
			data: username,
			success: true,
		});
	});

	it.each([
		["空串", ""],
		["只有空格", "   "],
		["40 个字符", "a".repeat(USERNAME_MAX_LENGTH + 1)],
		["以 - 开头", "-octocat"],
		["以 - 结尾", "octocat-"],
		["只有 -", "-"],
		["连续两个 -", "octo--cat"],
		["中文", "章鱼猫"],
		["字母混中文", "octo猫"],
		["下划线", "octo_cat"],
		["点", "octo.cat"],
		["中间有空格", "octo cat"],
	])("非法：%s", (_label, username) => {
		const result = githubUsernameSchema.safeParse(username);
		expect(result.success).toBe(false);
		expect(firstIssueMessage(result)).toBe(USERNAME_ERROR);
	});

	it("去掉首尾空格后再校验", () => {
		expect(githubUsernameSchema.parse("  octocat  ")).toBe("octocat");
		expect(
			githubUsernameSchema.parse(` ${"a".repeat(USERNAME_MAX_LENGTH)} `)
		).toBe("a".repeat(USERNAME_MAX_LENGTH));
	});
});

describe("searchKeywordSchema", () => {
	it("0 个字符不通过", () => {
		const result = searchKeywordSchema.safeParse("");
		expect(result.success).toBe(false);
		expect(firstIssueMessage(result)).toBe(KEYWORD_EMPTY_ERROR);
	});

	it("只有空格，去掉后为 0 个字符，不通过", () => {
		const result = searchKeywordSchema.safeParse("   ");
		expect(result.success).toBe(false);
		expect(firstIssueMessage(result)).toBe(KEYWORD_EMPTY_ERROR);
	});

	it("1 个字符通过", () => {
		expect(searchKeywordSchema.parse("a")).toBe("a");
	});

	it("100 个字符通过", () => {
		const keyword = "a".repeat(SEARCH_KEYWORD_MAX_LENGTH);
		expect(searchKeywordSchema.parse(keyword)).toBe(keyword);
	});

	it("101 个字符不通过", () => {
		const result = searchKeywordSchema.safeParse(
			"a".repeat(SEARCH_KEYWORD_MAX_LENGTH + 1)
		);
		expect(result.success).toBe(false);
		expect(firstIssueMessage(result)).toBe(KEYWORD_TOO_LONG_ERROR);
	});

	it("去掉首尾空格后返回", () => {
		expect(searchKeywordSchema.parse("  octo cat  ")).toBe("octo cat");
	});

	it("首尾空格不计入长度：100 个字符加首尾空格仍通过", () => {
		const keyword = "a".repeat(SEARCH_KEYWORD_MAX_LENGTH);
		expect(searchKeywordSchema.parse(`  ${keyword}  `)).toBe(keyword);
	});

	it("首尾空格包住 1 个字符，返回该字符", () => {
		expect(searchKeywordSchema.parse("  a  ")).toBe("a");
	});

	it("中文关键字按字符计数", () => {
		const keyword = "猫".repeat(SEARCH_KEYWORD_MAX_LENGTH);
		expect(searchKeywordSchema.parse(keyword)).toBe(keyword);
		expect(searchKeywordSchema.safeParse(`${keyword}猫`).success).toBe(false);
	});
});

describe("remarkSchema", () => {
	it("去掉首尾空格；空字符串和 null 都转成 null", () => {
		expect(remarkSchema.parse("  备注  ")).toBe("备注");
		expect(remarkSchema.parse("   ")).toBeNull();
		expect(remarkSchema.parse("")).toBeNull();
		expect(remarkSchema.parse(null)).toBeNull();
	});

	it("最多 500 个字符", () => {
		const remark = "a".repeat(REMARK_MAX_LENGTH);
		expect(remarkSchema.parse(remark)).toBe(remark);
		expect(remarkSchema.safeParse(`${remark}a`).success).toBe(false);
	});
});

describe("tagsSchema", () => {
	it("每个去掉首尾空格、去掉空的、去重", () => {
		expect(tagsSchema.parse([" 前端 ", "", "  ", "前端", "后端"])).toEqual([
			"前端",
			"后端",
		]);
	});

	it("归一化之后最多 10 个", () => {
		const tags = Array.from({ length: TAGS_MAX_COUNT }, (_, i) => `t${i}`);
		expect(tagsSchema.parse([...tags, "t0", ""])).toEqual(tags);
		expect(tagsSchema.safeParse([...tags, "extra"]).success).toBe(false);
	});

	it("每个最多 20 个字符", () => {
		const tag = "a".repeat(TAG_MAX_LENGTH);
		expect(tagsSchema.parse([tag])).toEqual([tag]);
		expect(tagsSchema.safeParse([`${tag}a`]).success).toBe(false);
	});
});
