"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import {
	GITHUB_USER_LIST_PAGE_SIZES,
	type GithubUserListOrder,
	type GithubUserListPageSize,
	type GithubUserListSort,
	SEARCH_KEYWORD_MAX_LENGTH,
} from "@zyk-aws-admin/api/github/schemas";
import type { AppRouter } from "@zyk-aws-admin/api/routers/index";
import { Alert, AlertDescription } from "@zyk-aws-admin/ui/components/alert";
import { Button, buttonVariants } from "@zyk-aws-admin/ui/components/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@zyk-aws-admin/ui/components/empty";
import { Field, FieldLabel } from "@zyk-aws-admin/ui/components/field";
import { Input } from "@zyk-aws-admin/ui/components/input";
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
} from "@zyk-aws-admin/ui/components/pagination";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@zyk-aws-admin/ui/components/select";
import { Skeleton } from "@zyk-aws-admin/ui/components/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@zyk-aws-admin/ui/components/table";
import { cn } from "@zyk-aws-admin/ui/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	type ChangeEvent,
	type FormEvent,
	type ReactNode,
	useCallback,
	useState,
} from "react";

import { GithubAvatar } from "@/components/github-users/github-avatar";
import { TagList } from "@/components/github-users/tag-list";
import { getAppErrorMessage } from "@/lib/app-error";
import { useTRPC } from "@/utils/trpc";

import {
	DEFAULT_LIST_PARAMS,
	type GithubUserListParams,
	hasListFilters,
	listHref,
} from "./list-params";

type ListResult = inferRouterOutputs<AppRouter>["githubUser"]["list"];
type ListItem = ListResult["items"][number];

const EMPTY_PLACEHOLDER = "—";
const TAGS_STALE_TIME_MS = 60_000;
/** 分页条在当前页两侧各显示几个页码 */
const PAGINATION_SIBLINGS = 1;
const SKELETON_ROWS = 5;
const SKELETON_ROW_KEYS = Array.from(
	{ length: SKELETON_ROWS },
	(_, index) => `skeleton-${index}`
);

// 固定区域格式；列表数据只在浏览器端获取，按浏览器本地时区显示
const NUMBER_FORMAT = new Intl.NumberFormat("zh-CN");
const DATE_TIME_FORMAT = new Intl.DateTimeFormat("zh-CN", {
	day: "2-digit",
	hour: "2-digit",
	hourCycle: "h23",
	minute: "2-digit",
	month: "2-digit",
	year: "numeric",
});

const SORT_ITEMS = [
	{ label: "添加时间", value: "createdAt" },
	{ label: "粉丝数", value: "followers" },
	{ label: "最后同步时间", value: "syncedAt" },
] as const satisfies readonly { label: string; value: GithubUserListSort }[];

const ORDER_LABELS: Record<GithubUserListOrder, string> = {
	asc: "升序",
	desc: "降序",
};

const PAGE_SIZE_ITEMS = GITHUB_USER_LIST_PAGE_SIZES.map((size) => ({
	label: `${size} 条/页`,
	value: size,
}));

const ALL_TAGS_LABEL = "全部标签";

function formatDateTime(iso: string): string {
	const date = new Date(iso);
	return Number.isNaN(date.getTime())
		? EMPTY_PLACEHOLDER
		: DATE_TIME_FORMAT.format(date);
}

/** 去掉首尾空白后为空就显示「—」 */
function TextCell({ value }: { value: string | null }) {
	const text = value?.trim() ?? "";
	return text === "" ? (
		<span className="text-muted-foreground">{EMPTY_PLACEHOLDER}</span>
	) : (
		text
	);
}

// ---- 筛选栏 ----

/** 筛选控件统一通过它提交改动，由列表组件合并进 URL 并回到第 1 页 */
type ApplyFilters = (changes: Partial<GithubUserListParams>) => void;

/** 关键字：回车或点「筛选」才提交，避免每输入一个字就请求 */
function KeywordForm({ q, onApply }: { q: string; onApply: ApplyFilters }) {
	const [value, setValue] = useState(q);
	const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setValue(event.target.value);
	}, []);
	const handleSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			onApply({ q: value.trim() });
		},
		[onApply, value]
	);
	return (
		<form className="flex items-end gap-2" onSubmit={handleSubmit}>
			<Field className="w-64">
				<FieldLabel htmlFor="github-user-list-keyword">关键字</FieldLabel>
				<Input
					autoComplete="off"
					id="github-user-list-keyword"
					maxLength={SEARCH_KEYWORD_MAX_LENGTH}
					name="q"
					onChange={handleChange}
					placeholder="用户名、昵称、公司或备注"
					type="search"
					value={value}
				/>
			</Field>
			<Button type="submit" variant="outline">
				筛选
			</Button>
		</form>
	);
}

/** 标签下拉：选项来自 githubUser.tags，「全部标签」对应 null（不过滤） */
function TagSelect({ tag, onApply }: { tag: string; onApply: ApplyFilters }) {
	const trpc = useTRPC();
	const { data: tags = [] } = useQuery(
		trpc.githubUser.tags.queryOptions(undefined, {
			staleTime: TAGS_STALE_TIME_MS,
		})
	);
	const handleValueChange = useCallback(
		(value: string | null) => {
			onApply({ tag: value ?? DEFAULT_LIST_PARAMS.tag });
		},
		[onApply]
	);
	// URL 里的标签可能已没有记录在用，仍放进选项，保证下拉框能显示当前值
	const options = tag === "" || tags.includes(tag) ? tags : [tag, ...tags];
	const items = [
		{ label: ALL_TAGS_LABEL, value: null },
		...options.map((option) => ({ label: option, value: option })),
	];
	return (
		<Field className="w-40">
			<FieldLabel htmlFor="github-user-list-tag">标签</FieldLabel>
			<Select
				items={items}
				onValueChange={handleValueChange}
				value={tag === "" ? null : tag}
			>
				<SelectTrigger className="w-full" id="github-user-list-tag">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{items.map((item) => (
						<SelectItem key={item.value ?? ""} value={item.value}>
							{item.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</Field>
	);
}

function SortControls({
	sort,
	order,
	onApply,
}: {
	sort: GithubUserListSort;
	order: GithubUserListOrder;
	onApply: ApplyFilters;
}) {
	const nextOrder: GithubUserListOrder = order === "desc" ? "asc" : "desc";
	const handleSortChange = useCallback(
		(value: GithubUserListSort | null) => {
			if (value !== null) {
				onApply({ sort: value });
			}
		},
		[onApply]
	);
	const handleOrderToggle = useCallback(() => {
		onApply({ order: nextOrder });
	}, [onApply, nextOrder]);
	return (
		<div className="flex items-end gap-2">
			<Field className="w-36">
				<FieldLabel htmlFor="github-user-list-sort">排序</FieldLabel>
				<Select
					items={SORT_ITEMS}
					onValueChange={handleSortChange}
					value={sort}
				>
					<SelectTrigger className="w-full" id="github-user-list-sort">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{SORT_ITEMS.map((item) => (
							<SelectItem key={item.value} value={item.value}>
								{item.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</Field>
			<Button
				aria-label={`排序方向：${ORDER_LABELS[order]}，点击切换为${ORDER_LABELS[nextOrder]}`}
				onClick={handleOrderToggle}
				type="button"
				variant="outline"
			>
				{ORDER_LABELS[order]}
				<span aria-hidden="true">{order === "desc" ? "↓" : "↑"}</span>
			</Button>
		</div>
	);
}

function PageSizeSelect({
	pageSize,
	onApply,
}: {
	pageSize: GithubUserListPageSize;
	onApply: ApplyFilters;
}) {
	const handleValueChange = useCallback(
		(value: GithubUserListPageSize | null) => {
			if (value !== null) {
				onApply({ pageSize: value });
			}
		},
		[onApply]
	);
	return (
		<Field className="w-28">
			<FieldLabel htmlFor="github-user-list-page-size">每页条数</FieldLabel>
			<Select
				items={PAGE_SIZE_ITEMS}
				onValueChange={handleValueChange}
				value={pageSize}
			>
				<SelectTrigger className="w-full" id="github-user-list-page-size">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{PAGE_SIZE_ITEMS.map((item) => (
						<SelectItem key={item.value} value={item.value}>
							{item.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</Field>
	);
}

// ---- 表格和分页 ----

const COLUMN_LABELS = [
	"头像",
	"用户名",
	"昵称",
	"公司",
	"所在地",
	"粉丝数",
	"公开仓库数",
	"标签",
	"最后同步时间",
	"操作",
] as const;

function UserRow({ user }: { user: ListItem }) {
	return (
		<TableRow>
			<TableCell>
				<GithubAvatar login={user.login} src={user.avatarUrl} />
			</TableCell>
			<TableCell className="font-medium">{user.login}</TableCell>
			<TableCell>
				<TextCell value={user.name} />
			</TableCell>
			<TableCell>
				<TextCell value={user.company} />
			</TableCell>
			<TableCell>
				<TextCell value={user.location} />
			</TableCell>
			<TableCell className="text-right tabular-nums">
				{NUMBER_FORMAT.format(user.followers)}
			</TableCell>
			<TableCell className="text-right tabular-nums">
				{NUMBER_FORMAT.format(user.publicRepos)}
			</TableCell>
			<TableCell className="whitespace-normal">
				<TagList className="min-w-32" tags={user.tags} />
			</TableCell>
			<TableCell className="tabular-nums">
				<time dateTime={user.syncedAt}>{formatDateTime(user.syncedAt)}</time>
			</TableCell>
			<TableCell>
				<Link
					className="underline underline-offset-4"
					href={`/github-users/${user.id}`}
				>
					查看<span className="sr-only">：{user.login}</span>
				</Link>
			</TableCell>
		</TableRow>
	);
}

function UserTable({ items }: { items: ListItem[] }) {
	return (
		<Table>
			<TableHeader>
				<TableRow>
					{COLUMN_LABELS.map((label) => (
						<TableHead
							className={cn(
								(label === "粉丝数" || label === "公开仓库数") && "text-right"
							)}
							key={label}
						>
							{label}
						</TableHead>
					))}
				</TableRow>
			</TableHeader>
			<TableBody>
				{items.map((user) => (
					<UserRow key={user.id} user={user} />
				))}
			</TableBody>
		</Table>
	);
}

type PageToken = number | "start-ellipsis" | "end-ellipsis";

/** 页码列表：首页、末页、当前页及两侧，中间省略的部分用省略号 */
function pageTokens(page: number, totalPages: number): PageToken[] {
	const start = Math.max(2, page - PAGINATION_SIBLINGS);
	const end = Math.min(totalPages - 1, page + PAGINATION_SIBLINGS);
	const tokens: PageToken[] = [1];
	if (start > 2) {
		tokens.push("start-ellipsis");
	}
	for (let current = start; current <= end; current += 1) {
		tokens.push(current);
	}
	if (end < totalPages - 1) {
		tokens.push("end-ellipsis");
	}
	if (totalPages > 1) {
		tokens.push(totalPages);
	}
	return tokens;
}

function PageLink({
	params,
	page,
	disabled = false,
	isActive = false,
	label,
	children,
}: {
	params: GithubUserListParams;
	page: number;
	disabled?: boolean;
	isActive?: boolean;
	label: string;
	children: ReactNode;
}) {
	const className = buttonVariants({
		size: typeof children === "number" ? "icon" : "default",
		variant: isActive ? "outline" : "ghost",
	});
	if (disabled) {
		return (
			<span
				aria-disabled="true"
				className={cn(className, "pointer-events-none opacity-50")}
			>
				{children}
			</span>
		);
	}
	return (
		<Link
			aria-current={isActive ? "page" : undefined}
			aria-label={label}
			className={className}
			href={listHref({ ...params, page })}
		>
			{children}
		</Link>
	);
}

function ListPagination({
	params,
	total,
}: {
	params: GithubUserListParams;
	total: number;
}) {
	const { page, pageSize } = params;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	return (
		<div className="flex flex-wrap items-center justify-between gap-4">
			<p className="text-muted-foreground text-sm">
				共 {NUMBER_FORMAT.format(total)} 条，第 {page} / {totalPages} 页
			</p>
			<Pagination aria-label="名单分页" className="mx-0 w-auto">
				<PaginationContent>
					<PaginationItem>
						<PageLink
							disabled={page <= 1}
							label="上一页"
							page={page - 1}
							params={params}
						>
							上一页
						</PageLink>
					</PaginationItem>
					{pageTokens(page, totalPages).map((token) =>
						typeof token === "number" ? (
							<PaginationItem key={token}>
								<PageLink
									isActive={token === page}
									label={`第 ${token} 页`}
									page={token}
									params={params}
								>
									{token}
								</PageLink>
							</PaginationItem>
						) : (
							<PaginationItem key={token}>
								<PaginationEllipsis />
							</PaginationItem>
						)
					)}
					<PaginationItem>
						<PageLink
							disabled={page >= totalPages}
							label="下一页"
							page={page + 1}
							params={params}
						>
							下一页
						</PageLink>
					</PaginationItem>
				</PaginationContent>
			</Pagination>
		</div>
	);
}

// ---- 状态 ----

function LoadingState() {
	return (
		<div
			aria-label="正在加载名单"
			className="flex flex-col gap-2"
			role="status"
		>
			{SKELETON_ROW_KEYS.map((key) => (
				<Skeleton className="h-12 w-full" key={key} />
			))}
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
				<span>{getAppErrorMessage(error)}</span>
				<Button onClick={onRetry} size="sm" type="button" variant="outline">
					重试
				</Button>
			</AlertDescription>
		</Alert>
	);
}

function EmptyListState() {
	return (
		<Empty>
			<EmptyHeader>
				<EmptyTitle>名单还是空的</EmptyTitle>
				<EmptyDescription>
					搜索 GitHub 用户并加入名单后会显示在这里
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Link className={buttonVariants()} href="/github-users/new">
					添加用户
				</Link>
			</EmptyContent>
		</Empty>
	);
}

/** 有记录但当前条件下没有结果：有筛选条件时可清除筛选，页码超出范围时可回到第 1 页 */
function NoMatchState({
	params,
	total,
}: {
	params: GithubUserListParams;
	total: number;
}) {
	const filtered = hasListFilters(params);
	const pageOutOfRange = total > 0;
	return (
		<Empty>
			<EmptyHeader>
				<EmptyTitle>没有匹配的记录</EmptyTitle>
				{pageOutOfRange ? (
					<EmptyDescription>
						共 {NUMBER_FORMAT.format(total)} 条，当前页没有记录
					</EmptyDescription>
				) : null}
			</EmptyHeader>
			<EmptyContent className="flex-row justify-center gap-2">
				{pageOutOfRange ? (
					<Link
						className={buttonVariants({ variant: "outline" })}
						href={listHref({ ...params, page: 1 })}
					>
						回到第 1 页
					</Link>
				) : null}
				{filtered ? (
					<Link
						className={buttonVariants({ variant: "outline" })}
						href={listHref({
							...params,
							page: DEFAULT_LIST_PARAMS.page,
							q: DEFAULT_LIST_PARAMS.q,
							tag: DEFAULT_LIST_PARAMS.tag,
						})}
					>
						清除筛选
					</Link>
				) : null}
			</EmptyContent>
		</Empty>
	);
}

function ListBody({
	data,
	error,
	params,
	onRetry,
}: {
	data: ListResult | undefined;
	error: unknown;
	params: GithubUserListParams;
	onRetry: () => void;
}) {
	if (error) {
		return <ErrorState error={error} onRetry={onRetry} />;
	}
	if (!data) {
		return <LoadingState />;
	}
	if (data.total === 0 && !hasListFilters(params)) {
		return <EmptyListState />;
	}
	if (data.items.length === 0) {
		return <NoMatchState params={params} total={data.total} />;
	}
	return (
		<>
			<UserTable items={data.items} />
			<ListPagination params={params} total={data.total} />
		</>
	);
}

/**
 * 名单列表（R05）：筛选、排序、页码、每页条数都来自 URL 参数（由 page.tsx 解析后传入）。
 * 筛选、排序、每页条数变化时用 router.replace 更新 URL 并回到第 1 页；只读本地数据库，不请求 GitHub。
 */
export function GithubUserList({ params }: { params: GithubUserListParams }) {
	const router = useRouter();
	const trpc = useTRPC();
	const { q, tag, sort, order, page, pageSize } = params;
	const query = useQuery(
		trpc.githubUser.list.queryOptions(
			{
				order,
				page,
				pageSize,
				q: q === "" ? undefined : q,
				sort,
				tag: tag === "" ? undefined : tag,
			},
			{
				meta: { skipGlobalErrorToast: true },
				placeholderData: keepPreviousData,
			}
		)
	);
	const { refetch } = query;

	const applyFilters = useCallback(
		async (changes: Partial<GithubUserListParams>) => {
			const href = listHref({ ...params, ...changes, page: 1 });
			if (href === listHref(params)) {
				// URL 不变时（例如原样再提交一次关键字）直接重新查询
				await refetch();
				return;
			}
			router.replace(href);
		},
		[params, refetch, router]
	);
	const handleRetry = useCallback(async () => {
		await refetch();
	}, [refetch]);

	return (
		<div className="mt-6 flex flex-col gap-4">
			<search
				aria-label="筛选名单"
				className="flex flex-wrap items-end gap-x-6 gap-y-3"
			>
				<KeywordForm key={q} onApply={applyFilters} q={q} />
				<TagSelect onApply={applyFilters} tag={tag} />
				<SortControls onApply={applyFilters} order={order} sort={sort} />
				<PageSizeSelect onApply={applyFilters} pageSize={pageSize} />
			</search>
			<section
				aria-busy={query.isFetching}
				aria-label="GitHub 用户名单"
				className="flex flex-col gap-4 transition-opacity data-[placeholder=true]:opacity-60"
				data-placeholder={query.isPlaceholderData}
			>
				<ListBody
					data={query.data}
					error={query.error}
					onRetry={handleRetry}
					params={params}
				/>
			</section>
		</div>
	);
}
