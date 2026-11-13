// GitHub 资料 / 数据库记录 → 写入数据 / 接口输出。
// tRPC 没有配置 transformer，Date 经 JSON 会变成字符串，所以接口输出里的日期统一转成 ISO 字符串，
// 让类型和前端实际收到的数据一致（design.md「方案概述」第 7 条）。
import type { GithubUser } from "@zyk-aws-admin/db";

import type { GithubProfile } from "./schemas";

/** 从 GitHub 同步的字段（不含 remark、tags、createdById、syncedAt），添加和同步共用 */
export interface GithubUserData {
	avatarUrl: string;
	bio: string | null;
	blog: string | null;
	company: string | null;
	email: string | null;
	followers: number;
	following: number;
	githubCreatedAt: Date;
	githubId: number;
	githubUpdatedAt: Date;
	htmlUrl: string;
	location: string | null;
	login: string;
	name: string | null;
	publicGists: number;
	publicRepos: number;
	twitterUsername: string | null;
}

/** GitHub 资料的接口输出（查询、添加前预览） */
export type GithubProfileDto = Omit<
	GithubUserData,
	"githubCreatedAt" | "githubUpdatedAt"
> & {
	githubCreatedAt: string;
	githubUpdatedAt: string;
};

/** 名单记录的接口输出 */
export type GithubUserRecordDto = GithubProfileDto & {
	createdAt: string;
	createdById: string;
	id: number;
	remark: string | null;
	syncedAt: string;
	tags: string[];
	updatedAt: string;
};

/** GitHub 资料 → Prisma 写入数据（只含 GitHub 字段） */
export const toGithubUserData = (profile: GithubProfile): GithubUserData => ({
	avatarUrl: profile.avatar_url,
	bio: profile.bio,
	blog: profile.blog,
	company: profile.company,
	email: profile.email,
	followers: profile.followers,
	following: profile.following,
	githubCreatedAt: new Date(profile.created_at),
	githubId: profile.id,
	githubUpdatedAt: new Date(profile.updated_at),
	htmlUrl: profile.html_url,
	location: profile.location,
	login: profile.login,
	name: profile.name,
	publicGists: profile.public_gists,
	publicRepos: profile.public_repos,
	twitterUsername: profile.twitter_username,
});

const toProfileFields = (data: GithubUserData): GithubProfileDto => ({
	avatarUrl: data.avatarUrl,
	bio: data.bio,
	blog: data.blog,
	company: data.company,
	email: data.email,
	followers: data.followers,
	following: data.following,
	githubCreatedAt: data.githubCreatedAt.toISOString(),
	githubId: data.githubId,
	githubUpdatedAt: data.githubUpdatedAt.toISOString(),
	htmlUrl: data.htmlUrl,
	location: data.location,
	login: data.login,
	name: data.name,
	publicGists: data.publicGists,
	publicRepos: data.publicRepos,
	twitterUsername: data.twitterUsername,
});

/** GitHub 资料 → 接口输出；日期先转 Date 再转 ISO，和记录输出的格式一致 */
export const toProfileDto = (profile: GithubProfile): GithubProfileDto =>
	toProfileFields(toGithubUserData(profile));

/** 数据库记录 → 接口输出（日期转 ISO 字符串） */
export const toRecordDto = (record: GithubUser): GithubUserRecordDto => ({
	...toProfileFields(record),
	createdAt: record.createdAt.toISOString(),
	createdById: record.createdById,
	id: record.id,
	remark: record.remark,
	syncedAt: record.syncedAt.toISOString(),
	tags: record.tags,
	updatedAt: record.updatedAt.toISOString(),
});
