"use client";

import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { searchKeywordSchema } from "@zyk-aws-admin/api/github/schemas";
import type { AppRouter } from "@zyk-aws-admin/api/routers/index";
import { Alert, AlertDescription } from "@zyk-aws-admin/ui/components/alert";
import { Badge } from "@zyk-aws-admin/ui/components/badge";
import { Button } from "@zyk-aws-admin/ui/components/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@zyk-aws-admin/ui/components/empty";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@zyk-aws-admin/ui/components/field";
import { Input } from "@zyk-aws-admin/ui/components/input";
import { Skeleton } from "@zyk-aws-admin/ui/components/skeleton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useCallback } from "react";
import z from "zod";

import { GithubAvatar } from "@/components/github-users/github-avatar";
import { getAppErrorMessage } from "@/lib/app-error";
import { useTRPC } from "@/utils/trpc";

import { searchHref } from "./search-params";

const SEARCH_STALE_TIME_MS = 60_000;
const MAX_SEARCH_RESULTS = 1000;
type SearchResult = inferRouterOutputs<AppRouter>["githubUser"]["search"];

function SearchInput({
	value,
	onValueChange,
	onBlur,
	errors,
}: {
	value: string;
	onValueChange: (value: string) => void;
	onBlur: () => void;
	errors: ({ message?: string } | undefined)[];
}) {
	const handleChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			onValueChange(event.target.value);
		},
		[onValueChange]
	);
	return (
		<Field data-invalid={errors.length > 0}>
			<FieldLabel htmlFor="github-search-keyword">搜索关键字</FieldLabel>
			<Input
				aria-describedby="github-search-error"
				aria-invalid={errors.length > 0}
				autoComplete="off"
				id="github-search-keyword"
				name="q"
				onBlur={onBlur}
				onChange={handleChange}
				placeholder="输入用户名或昵称，例如 linus"
				value={value}
			/>
			<FieldError errors={errors} id="github-search-error" />
		</Field>
	);
}

function SearchResults({
	data,
	error,
	isFetching,
	enabled,
	q,
	page,
	onPrevious,
	onNext,
}: {
	data: SearchResult | undefined;
	error: unknown;
	isFetching: boolean;
	enabled: boolean;
	q: string;
	page: number;
	onPrevious: () => void;
	onNext: () => void;
}) {
	if (!enabled) {
		return null;
	}
	if (error) {
		return (
			<Alert variant="destructive">
				<AlertDescription>{getAppErrorMessage(error)}</AlertDescription>
			</Alert>
		);
	}
	if (!data) {
		return (
			<div aria-label="正在搜索 GitHub 用户" role="status">
				<Skeleton className="h-16 w-full" />
			</div>
		);
	}
	if (data.items.length === 0) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyTitle>
						{data.total === 0 ? "没有找到匹配的 GitHub 用户" : "当前页没有结果"}
					</EmptyTitle>
					{data.total > 0 ? (
						<EmptyDescription>
							共 {data.total.toLocaleString()} 位用户
						</EmptyDescription>
					) : null}
				</EmptyHeader>
				{page > 1 ? (
					<EmptyContent>
						<Link
							className="underline underline-offset-4"
							href={searchHref(q, 1)}
						>
							返回第一页
						</Link>
					</EmptyContent>
				) : null}
			</Empty>
		);
	}
	return (
		<section
			aria-busy={isFetching}
			aria-label="搜索结果"
			className="flex flex-col gap-4"
		>
			<p className="text-muted-foreground text-sm">
				共 {data.total.toLocaleString()} 位用户
			</p>
			{data.total > MAX_SEARCH_RESULTS && (
				<Alert>
					<AlertDescription>结果太多，请输入更具体的关键字</AlertDescription>
				</Alert>
			)}
			<ul className="divide-y rounded-none border">
				{data.items.map((user) => (
					<li className="flex items-center gap-4 p-3" key={user.githubId}>
						<Link
							className="flex min-w-0 flex-1 items-center gap-3 hover:underline"
							href={searchHref(q, page, user.login)}
						>
							<GithubAvatar login={user.login} src={user.avatarUrl} />
							<span className="min-w-0 break-all font-medium">
								{user.login}
							</span>
							{user.exactMatch ? <Badge>精确匹配</Badge> : null}
							{user.savedId !== null && (
								<Badge variant="secondary">已在名单中</Badge>
							)}
						</Link>
						<a
							className="shrink-0 text-muted-foreground text-sm underline underline-offset-4"
							href={user.htmlUrl}
							rel="noopener noreferrer"
							target="_blank"
						>
							GitHub 主页<span className="sr-only">：{user.login}</span>
						</a>
					</li>
				))}
			</ul>
			<nav
				aria-label="搜索结果分页"
				className="flex items-center justify-between gap-4"
			>
				<Button
					disabled={page <= 1 || isFetching}
					onClick={onPrevious}
					variant="outline"
				>
					上一页
				</Button>
				<span className="text-sm">第 {page} 页</span>
				<Button
					disabled={!data.hasMore || isFetching}
					onClick={onNext}
					variant="outline"
				>
					下一页
				</Button>
			</nav>
		</section>
	);
}

export function GithubSearch({ q, page }: { q: string; page: number }) {
	const router = useRouter();
	const trpc = useTRPC();
	const parsed = searchKeywordSchema.safeParse(q);
	const keyword = parsed.success ? parsed.data : "";
	const query = useQuery(
		trpc.githubUser.search.queryOptions(
			{ page, q: keyword },
			{
				enabled: parsed.success,
				meta: { skipGlobalErrorToast: true },
				refetchOnWindowFocus: false,
				retry: false,
				staleTime: SEARCH_STALE_TIME_MS,
			}
		)
	);
	const form = useForm({
		defaultValues: { q },
		onSubmit: async ({ value }) => {
			const normalized = searchKeywordSchema.parse(value.q);
			if (normalized === keyword && page === 1) {
				if (query.isStale) {
					await query.refetch();
				}
				return;
			}
			router.push(searchHref(normalized, 1));
		},
		validators: { onSubmit: z.object({ q: searchKeywordSchema }) },
	});
	const handleSubmit = useCallback(
		async (event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			await form.handleSubmit();
		},
		[form]
	);
	const handlePrevious = useCallback(() => {
		router.push(searchHref(keyword, page - 1));
	}, [router, keyword, page]);
	const handleNext = useCallback(() => {
		router.push(searchHref(keyword, page + 1));
	}, [router, keyword, page]);

	return (
		<div className="mt-6 flex flex-col gap-6">
			<form onSubmit={handleSubmit}>
				<FieldGroup>
					<form.Field name="q">
						{(field) => (
							<SearchInput
								errors={field.state.meta.errors}
								onBlur={field.handleBlur}
								onValueChange={field.handleChange}
								value={field.state.value}
							/>
						)}
					</form.Field>
					<Button
						className="self-start"
						disabled={query.isFetching}
						type="submit"
					>
						{query.isFetching ? "搜索中..." : "搜索"}
					</Button>
				</FieldGroup>
			</form>
			{q !== "" && !parsed.success && (
				<Alert variant="destructive">
					<AlertDescription>{parsed.error.issues[0]?.message}</AlertDescription>
				</Alert>
			)}
			<SearchResults
				data={query.data}
				enabled={parsed.success}
				error={query.error}
				isFetching={query.isFetching}
				onNext={handleNext}
				onPrevious={handlePrevious}
				page={page}
				q={keyword}
			/>
		</div>
	);
}
