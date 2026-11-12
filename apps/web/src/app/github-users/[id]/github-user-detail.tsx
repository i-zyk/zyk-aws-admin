"use client";

import { useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@zyk-aws-admin/api/routers/index";
import { Alert, AlertDescription } from "@zyk-aws-admin/ui/components/alert";
import { Button } from "@zyk-aws-admin/ui/components/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "@zyk-aws-admin/ui/components/card";
import { Skeleton } from "@zyk-aws-admin/ui/components/skeleton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback } from "react";

import { DeleteGithubUserDialog } from "@/components/github-users/delete-github-user-dialog";
import { EditGithubUserDialog } from "@/components/github-users/edit-github-user-dialog";
import { GithubProfileCard } from "@/components/github-users/github-profile-card";
import { SyncGithubUserButton } from "@/components/github-users/sync-github-user-button";
import { TagList } from "@/components/github-users/tag-list";
import { getAppCode, getAppErrorMessage } from "@/lib/app-error";
import { formatDateTime } from "@/lib/format-date-time";
import { useTRPC } from "@/utils/trpc";

import { RecordNotFound } from "./record-not-found";

type DetailResult = inferRouterOutputs<AppRouter>["githubUser"]["byId"];

const EMPTY_PLACEHOLDER = "—";
const NO_TAGS_LABEL = "无标签";
const DELETED_USER_LABEL = "已删除的用户";
/** 网络等临时错误最多重试几次；记录不存在时不重试 */
const MAX_RETRIES = 3;

const shouldRetry = (failureCount: number, error: unknown): boolean =>
	getAppCode(error) !== "RECORD_NOT_FOUND" && failureCount < MAX_RETRIES;

function InfoField({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<div className="flex min-w-0 flex-col gap-0.5">
			<dt className="text-muted-foreground">{label}</dt>
			<dd className="min-w-0 break-words">{children}</dd>
		</div>
	);
}

function RemarkValue({ remark }: { remark: string | null }) {
	const text = remark?.trim() ?? "";
	if (text === "") {
		return <span className="text-muted-foreground">{EMPTY_PLACEHOLDER}</span>;
	}
	return <span className="whitespace-pre-line">{text}</span>;
}

function TagsValue({ tags }: { tags: readonly string[] }) {
	if (tags.length === 0) {
		return <span className="text-muted-foreground">{NO_TAGS_LABEL}</span>;
	}
	return <TagList tags={tags} />;
}

/** 添加人：账号已删除时 createdBy 为 null（R06-AC3） */
function CreatorValue({ createdBy }: { createdBy: DetailResult["createdBy"] }) {
	if (createdBy === null) {
		return <span className="text-muted-foreground">{DELETED_USER_LABEL}</span>;
	}
	return createdBy.name.trim() === "" ? EMPTY_PLACEHOLDER : createdBy.name;
}

function DateTimeValue({ iso }: { iso: string }) {
	return (
		<time className="tabular-nums" dateTime={iso}>
			{formatDateTime(iso)}
		</time>
	);
}

/**
 * 后台信息（R06-AC2）：备注、标签、添加人、添加时间、最后同步时间。
 * 只有备注和标签可以通过「编辑」修改（R07）；上方的 GitHub 资料卡片保持只读。
 */
function AdminInfoCard({ record }: { record: DetailResult }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>后台信息</CardTitle>
				<CardAction>
					<EditGithubUserDialog record={record} />
				</CardAction>
			</CardHeader>
			<CardContent>
				<dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
					<div className="sm:col-span-2">
						<InfoField label="备注">
							<RemarkValue remark={record.remark} />
						</InfoField>
					</div>
					<div className="sm:col-span-2">
						<InfoField label="标签">
							<TagsValue tags={record.tags} />
						</InfoField>
					</div>
					<InfoField label="添加人">
						<CreatorValue createdBy={record.createdBy} />
					</InfoField>
					<InfoField label="添加时间">
						<DateTimeValue iso={record.createdAt} />
					</InfoField>
					<InfoField label="最后同步时间">
						<DateTimeValue iso={record.syncedAt} />
					</InfoField>
				</dl>
			</CardContent>
		</Card>
	);
}

function LoadingState() {
	return (
		<div
			aria-label="正在加载用户详情"
			className="flex flex-col gap-4"
			role="status"
		>
			<Skeleton className="h-80 w-full" />
			<Skeleton className="h-40 w-full" />
		</div>
	);
}

function ErrorState({
	error,
	onRetry,
}: {
	error: unknown;
	onRetry: () => void;
}) {
	return (
		<Alert variant="destructive">
			<AlertDescription className="flex flex-wrap items-center justify-between gap-2">
				<span>详情加载失败：{getAppErrorMessage(error)}</span>
				<Button onClick={onRetry} size="sm" type="button" variant="outline">
					重试
				</Button>
			</AlertDescription>
		</Alert>
	);
}

function DetailBody({
	data,
	error,
	onRetry,
}: {
	data: DetailResult | undefined;
	error: unknown;
	onRetry: () => void;
}) {
	if (error) {
		return getAppCode(error) === "RECORD_NOT_FOUND" ? (
			<RecordNotFound />
		) : (
			<ErrorState error={error} onRetry={onRetry} />
		);
	}
	if (!data) {
		return <LoadingState />;
	}
	return (
		<>
			<GithubProfileCard profile={data} />
			<AdminInfoCard record={data} />
		</>
	);
}

/**
 * 名单记录详情（R06）：资料卡片（复用 R03）+ 后台信息。
 * 只查询 githubUser.byId（只读本地数据库，不请求 GitHub），错误在页面内显示，不弹全局 toast。
 */
export function GithubUserDetail({ id }: { id: number }) {
	const router = useRouter();
	const trpc = useTRPC();
	const query = useQuery(
		trpc.githubUser.byId.queryOptions(
			{ id },
			{
				meta: { skipGlobalErrorToast: true },
				retry: shouldRetry,
			}
		)
	);
	const { refetch } = query;
	const handleRetry = useCallback(async () => {
		await refetch();
	}, [refetch]);
	// 删除成功或记录已不存在时都回到列表（R09-AC2、R09-AC4）
	const handleDeleted = useCallback(() => {
		router.push("/github-users");
	}, [router]);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div className="flex min-w-0 flex-col gap-1">
					<Link
						className="self-start text-sm underline underline-offset-4"
						href="/github-users"
					>
						返回列表
					</Link>
					<h1 className="break-all font-bold text-2xl">
						{query.data?.login ?? "GitHub 用户详情"}
					</h1>
				</div>
				{/* 操作区：R07～R09 在这里加「编辑」「同步」「删除」按钮；记录加载成功后才显示 */}
				<div className="flex flex-wrap gap-2">
					{query.data ? (
						<>
							<SyncGithubUserButton id={id} />
							<DeleteGithubUserDialog
								id={id}
								login={query.data.login}
								onDeleted={handleDeleted}
							/>
						</>
					) : null}
				</div>
			</div>
			<section
				aria-busy={query.isFetching}
				aria-label="GitHub 用户详情"
				className="flex flex-col gap-4"
			>
				<DetailBody
					data={query.data}
					error={query.error}
					onRetry={handleRetry}
				/>
			</section>
		</div>
	);
}
