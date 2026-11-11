import type { GithubProfileDto } from "@zyk-aws-admin/api/github/mapper";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@zyk-aws-admin/ui/components/card";
import { cn } from "@zyk-aws-admin/ui/lib/utils";
import Image from "next/image";
import type { ReactNode } from "react";

import { ExternalLink } from "./external-link";

const EMPTY_PLACEHOLDER = "—";
const AVATAR_SIZE_PX = 80;
const ISO_DATE_LENGTH = "YYYY-MM-DD".length;
// 固定区域格式，服务端和浏览器渲染结果一致
const NUMBER_FORMAT = new Intl.NumberFormat("zh-CN");

/** 去掉首尾空白后为空就返回 null，调用方显示「—」 */
function presentText(value: string | null): string | null {
	const trimmed = value?.trim() ?? "";
	return trimmed === "" ? null : trimmed;
}

/** ISO 时间 → YYYY-MM-DD（按 UTC 取日期，避免服务端与浏览器时区不同导致结果不一致） */
function formatDate(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) {
		return EMPTY_PLACEHOLDER;
	}
	return date.toISOString().slice(0, ISO_DATE_LENGTH);
}

function ProfileField({
	label,
	children,
	wide = false,
}: {
	label: string;
	children: ReactNode;
	wide?: boolean;
}) {
	return (
		<div
			className={cn("flex min-w-0 flex-col gap-0.5", wide && "sm:col-span-2")}
		>
			<dt className="text-muted-foreground">{label}</dt>
			<dd className="min-w-0 break-words">{children ?? EMPTY_PLACEHOLDER}</dd>
		</div>
	);
}

function BlogValue({ blog }: { blog: string | null }) {
	const text = presentText(blog);
	if (text === null) {
		return EMPTY_PLACEHOLDER;
	}
	return <ExternalLink href={text}>{text}</ExternalLink>;
}

function TwitterValue({ username }: { username: string | null }) {
	const text = presentText(username);
	if (text === null) {
		return EMPTY_PLACEHOLDER;
	}
	return (
		<ExternalLink href={`https://x.com/${encodeURIComponent(text)}`}>
			@{text}
		</ExternalLink>
	);
}

/**
 * GitHub 资料卡片：只负责展示 15 个字段（R03-AC7）。
 * 操作区（「加入数据库」「已在名单中」等）由调用方通过 children 传入，R03 预览页和 R06 详情页共用。
 * 外部内容都按纯文本渲染（R03-AC10）。
 */
export function GithubProfileCard({
	profile,
	children,
}: {
	profile: GithubProfileDto;
	children?: ReactNode;
}) {
	const name = presentText(profile.name);
	return (
		<Card>
			<CardHeader className="flex items-center gap-4">
				<Image
					alt={`${profile.login} 的头像`}
					className="size-20 shrink-0 rounded-full bg-muted object-cover"
					height={AVATAR_SIZE_PX}
					src={profile.avatarUrl}
					unoptimized={process.env.NODE_ENV === "development"}
					width={AVATAR_SIZE_PX}
				/>
				<div className="flex min-w-0 flex-col gap-1">
					<CardTitle className="break-all text-lg">{profile.login}</CardTitle>
					<CardDescription className="break-words text-sm">
						{name ?? EMPTY_PLACEHOLDER}
					</CardDescription>
				</div>
			</CardHeader>
			<CardContent>
				<dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
					<ProfileField label="简介" wide>
						<span className="whitespace-pre-line">
							{presentText(profile.bio) ?? EMPTY_PLACEHOLDER}
						</span>
					</ProfileField>
					<ProfileField label="用户名">{profile.login}</ProfileField>
					<ProfileField label="昵称">{name}</ProfileField>
					<ProfileField label="公司">
						{presentText(profile.company)}
					</ProfileField>
					<ProfileField label="博客">
						<BlogValue blog={profile.blog} />
					</ProfileField>
					<ProfileField label="所在地">
						{presentText(profile.location)}
					</ProfileField>
					<ProfileField label="公开邮箱">
						{presentText(profile.email)}
					</ProfileField>
					<ProfileField label="Twitter">
						<TwitterValue username={profile.twitterUsername} />
					</ProfileField>
					<ProfileField label="GitHub 注册时间">
						{formatDate(profile.githubCreatedAt)}
					</ProfileField>
					<ProfileField label="公开仓库数">
						{NUMBER_FORMAT.format(profile.publicRepos)}
					</ProfileField>
					<ProfileField label="公开 Gist 数">
						{NUMBER_FORMAT.format(profile.publicGists)}
					</ProfileField>
					<ProfileField label="粉丝数">
						{NUMBER_FORMAT.format(profile.followers)}
					</ProfileField>
					<ProfileField label="关注数">
						{NUMBER_FORMAT.format(profile.following)}
					</ProfileField>
					<ProfileField label="GitHub 主页" wide>
						<ExternalLink href={profile.htmlUrl}>
							{profile.htmlUrl}
						</ExternalLink>
					</ProfileField>
				</dl>
			</CardContent>
			{children ? (
				<CardFooter className="flex flex-wrap gap-3">{children}</CardFooter>
			) : null}
		</Card>
	);
}
