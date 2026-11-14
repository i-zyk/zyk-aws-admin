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
import { Badge } from "@zyk-aws-admin/ui/components/badge";
import { Button, buttonVariants } from "@zyk-aws-admin/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@zyk-aws-admin/ui/components/card";
import { Checkbox } from "@zyk-aws-admin/ui/components/checkbox";
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
	SelectGroup,
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
import { ArrowUpRight, FolderGit2, GitFork, Search, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	type ChangeEvent,
	type FormEvent,
	type ReactNode,
	useCallback,
	useEffect,
	useState,
} from "react";

import { BulkDeleteGithubUsersDialog } from "@/components/github-users/bulk-delete-dialog";
import { DeleteGithubUserDialog } from "@/components/github-users/delete-github-user-dialog";
import { EditGithubUserDialog } from "@/components/github-users/edit-github-user-dialog";
import { GithubAvatar } from "@/components/github-users/github-avatar";
import { SyncGithubUserButton } from "@/components/github-users/sync-github-user-button";
import { TagList } from "@/components/github-users/tag-list";
import { getAppErrorMessage } from "@/lib/app-error";
import { formatDateTime } from "@/lib/format-date-time";
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

// 固定区域格式；时间格式见 lib/format-date-time.ts
const NUMBER_FORMAT = new Intl.NumberFormat("zh-CN");

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
		<form
			className="flex w-full items-end gap-2 sm:w-auto"
			onSubmit={handleSubmit}
		>
			<Field className="w-full sm:w-64">
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
				<Search data-icon="inline-start" />
				搜索
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
					<SelectGroup>
						{items.map((item) => (
							<SelectItem key={item.value ?? ""} value={item.value}>
								{item.label}
							</SelectItem>
						))}
					</SelectGroup>
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
						<SelectGroup>
							{SORT_ITEMS.map((item) => (
								<SelectItem key={item.value} value={item.value}>
									{item.label}
								</SelectItem>
							))}
						</SelectGroup>
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
					<SelectGroup>
						{PAGE_SIZE_ITEMS.map((item) => (
							<SelectItem key={item.value} value={item.value}>
								{item.label}
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
		</Field>
	);
}

// ---- 表格和分页 ----

const COLUMN_LABELS = [
	"开发者",
	"公司",
	"所在地",
	"粉丝数",
	"公开仓库数",
	"标签",
	"最后同步时间",
	"操作",
] as const;

// ---- 勾选（R10）：只在本页内勾选，URL 参数变化时清空 ----

/** 表格勾选相关的状态和回调，由 GithubUserList 维护、逐层传给表格 */
interface RowSelection {
	/** 列表还在显示上一组参数的旧数据（placeholder）时为 true，此时不能勾选 */
	disabled: boolean;
	onToggle: (id: number, checked: boolean) => void;
	onToggleAll: (checked: boolean) => void;
	selectedIds: ReadonlySet<number>;
}

const NO_SELECTION: ReadonlySet<number> = new Set<number>();

function UserRow({
	user,
	selected,
	selectionDisabled,
	onToggle,
	onDeleted,
}: {
	user: ListItem;
	selected: boolean;
	selectionDisabled: boolean;
	onToggle: RowSelection["onToggle"];
	onDeleted: () => void;
}) {
	const handleCheckedChange = useCallback(
		(checked: boolean) => {
			onToggle(user.id, checked);
		},
		[onToggle, user.id]
	);
	return (
		<TableRow data-state={selected ? "selected" : undefined}>
			<TableCell>
				<Checkbox
					aria-label={`选择 ${user.login}`}
					checked={selected}
					disabled={selectionDisabled}
					onCheckedChange={handleCheckedChange}
				/>
			</TableCell>
			<TableCell>
				<Link
					className="flex items-center gap-3"
					href={`/github-users/${user.id}`}
				>
					<GithubAvatar login={user.login} src={user.avatarUrl} />
					<div className="flex min-w-32 flex-col gap-1">
						<span className="font-medium">
							{user.name?.trim() || user.login}
						</span>
						<span className="text-muted-foreground text-xs">@{user.login}</span>
					</div>
				</Link>
			</TableCell>
			<TableCell>
				<div className="max-w-40 truncate" title={user.company ?? undefined}>
					<TextCell value={user.company} />
				</div>
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
				<time
					className="block w-24 whitespace-normal text-muted-foreground text-xs leading-5"
					dateTime={user.syncedAt}
				>
					{formatDateTime(user.syncedAt)}
				</time>
			</TableCell>
			<TableCell>
				<div className="flex items-center gap-3">
					<Link
						className="flex items-center gap-1 text-primary hover:underline"
						href={`/github-users/${user.id}`}
					>
						查看
						<ArrowUpRight aria-hidden="true" className="size-3" />
						<span className="sr-only">：{user.login}</span>
					</Link>
					<EditGithubUserDialog record={user} />
					<SyncGithubUserButton id={user.id} login={user.login} size="sm" />
					<DeleteGithubUserDialog
						id={user.id}
						login={user.login}
						onDeleted={onDeleted}
						size="sm"
					/>
				</div>
			</TableCell>
		</TableRow>
	);
}

function UserTable({
	items,
	selection,
	onDeleted,
}: {
	items: ListItem[];
	selection: RowSelection;
	onDeleted: () => void;
}) {
	const { disabled, selectedIds, onToggle, onToggleAll } = selection;
	const selectedCount = items.filter((user) => selectedIds.has(user.id)).length;
	const allSelected = items.length > 0 && selectedCount === items.length;
	const someSelected = selectedCount > 0 && !allSelected;
	return (
		<Table className="[&_td]:px-4 [&_td]:py-5 [&_th]:px-4 [&_th]:py-3">
			<TableHeader className="bg-muted/50">
				<TableRow>
					<TableHead className="w-10">
						<Checkbox
							aria-label="全选本页"
							checked={allSelected}
							disabled={disabled}
							indeterminate={someSelected}
							onCheckedChange={onToggleAll}
						/>
					</TableHead>
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
					<UserRow
						key={user.id}
						onDeleted={onDeleted}
						onToggle={onToggle}
						selected={selectedIds.has(user.id)}
						selectionDisabled={disabled}
						user={user}
					/>
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
		<div className="flex flex-wrap items-center justify-between gap-4 border-t px-5 py-4">
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
				<span>名单加载失败：{getAppErrorMessage(error)}</span>
				<Button onClick={onRetry} size="sm" type="button" variant="outline">
					重试
				</Button>
			</AlertDescription>
		</Alert>
	);
}

function EmptyListState() {
	return (
		<Empty className="min-h-80">
			<EmptyHeader>
				<span className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-accent text-primary">
					<Users className="size-6" />
				</span>
				<EmptyTitle>你的开发者网络，从这里开始</EmptyTitle>
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
	selection,
	onDeleted,
	onRetry,
}: {
	data: ListResult | undefined;
	error: unknown;
	params: GithubUserListParams;
	selection: RowSelection;
	onDeleted: () => void;
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
			<UserTable
				items={data.items}
				onDeleted={onDeleted}
				selection={selection}
			/>
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
	// 当前 URL 参数（页码、筛选、排序、每页条数）对应的列表，勾选和删除后的页码纠正都以它为作用域
	const selectionScope = listHref(params);

	// 删除后的页码纠正（R10 design.md）：删除时记下要纠正的列表参数和删除时刻，等该参数下的列表按删除后的数据
	// 刷新完，如果当前页（非第 1 页）已没有记录而总数仍大于 0，就跳到刷新后的最后一页。
	// 以刷新后的 total 为准，不用删除前的缓存去推算，这样别人先删掉了部分记录（count 偏小甚至为 0）时也能纠正；
	// total 为 0 时不跳转，显示空状态。
	const [pendingPageFix, setPendingPageFix] = useState<{
		scope: string;
		deletedAt: number;
	} | null>(null);
	const markPageFix = useCallback((scope: string) => {
		setPendingPageFix({ deletedAt: Date.now(), scope });
	}, []);
	const { dataUpdatedAt } = query;
	const refreshedData =
		query.isFetching || query.isPlaceholderData ? undefined : query.data;
	useEffect(() => {
		// 参数和登记时不同（例如退页的跳转还没生效、或已翻到别处）时先不处理；
		// 列表还没按删除后的数据刷新完（dataUpdatedAt 早于删除时刻）时继续等
		const waiting =
			!pendingPageFix ||
			pendingPageFix.scope !== selectionScope ||
			!refreshedData ||
			dataUpdatedAt <= pendingPageFix.deletedAt;
		if (waiting) {
			return;
		}
		setPendingPageFix(null);
		const pageIsEmpty = refreshedData.items.length === 0;
		if (page > 1 && pageIsEmpty && refreshedData.total > 0) {
			const lastPage = Math.max(1, Math.ceil(refreshedData.total / pageSize));
			router.replace(listHref({ ...params, page: lastPage }));
		}
	}, [
		dataUpdatedAt,
		page,
		pageSize,
		params,
		pendingPageFix,
		refreshedData,
		router,
		selectionScope,
	]);

	// 删掉的是当前页（非第 1 页）仅剩的一条时，列表刷新后该页为空，退回上一页（R09 design.md）；
	// 同时登记删除后的页码纠正，兜住别人同时删除记录导致上一页也为空的情况
	const isLastItemOnPage = query.data?.items.length === 1 && page > 1;
	const handleDeleted = useCallback(() => {
		if (!isLastItemOnPage) {
			markPageFix(selectionScope);
			return;
		}
		const previousPageHref = listHref({ ...params, page: page - 1 });
		markPageFix(previousPageHref);
		router.replace(previousPageHref);
	}, [isLastItemOnPage, markPageFix, page, params, router, selectionScope]);

	// 勾选只对当前 URL 参数有效：参数一变，旧的勾选自动作废（R10-AC5）
	const [selection, setSelection] = useState<{
		scope: string;
		ids: ReadonlySet<number>;
	}>({ ids: NO_SELECTION, scope: selectionScope });
	// 参数变化后在渲染时直接重置，否则翻页再翻回来时旧的勾选会恢复
	if (selection.scope !== selectionScope) {
		setSelection({ ids: NO_SELECTION, scope: selectionScope });
	}
	// 翻页、改筛选后新数据回来之前，keepPreviousData 仍显示上一组参数的旧记录：
	// 这时禁止勾选并视为没有勾选，避免把旧页的 ID 记到新参数下被批量删除
	const selectionDisabled: boolean = query.isPlaceholderData;
	const scopedIds =
		selection.scope === selectionScope && !selectionDisabled
			? selection.ids
			: NO_SELECTION;
	const pageItems: ListItem[] = selectionDisabled
		? []
		: (query.data?.items ?? []);
	// 只算本页还在的记录：单条删除或列表刷新后，已不在本页的 ID 不再计入
	const selectedIds = pageItems
		.filter((user) => scopedIds.has(user.id))
		.map((user) => user.id);
	const handleToggle = useCallback(
		(id: number, checked: boolean) => {
			setSelection((current) => {
				const next = new Set(
					current.scope === selectionScope ? current.ids : NO_SELECTION
				);
				if (checked) {
					next.add(id);
				} else {
					next.delete(id);
				}
				return { ids: next, scope: selectionScope };
			});
		},
		[selectionScope]
	);
	const handleToggleAll = useCallback(
		(checked: boolean) => {
			setSelection({
				ids: checked ? new Set(pageItems.map((user) => user.id)) : NO_SELECTION,
				scope: selectionScope,
			});
		},
		[pageItems, selectionScope]
	);
	const rowSelection: RowSelection = {
		disabled: selectionDisabled,
		onToggle: handleToggle,
		onToggleAll: handleToggleAll,
		selectedIds: scopedIds,
	};
	// 批量删除后清空勾选，并登记删除后的页码纠正：列表刷新后当前页删空时跳到最后一页（通常是上一页）
	const handleBulkDeleted = useCallback(() => {
		setSelection({ ids: NO_SELECTION, scope: selectionScope });
		markPageFix(selectionScope);
	}, [markPageFix, selectionScope]);

	return (
		<div className="flex flex-col gap-7">
			<div className="grid gap-4 sm:grid-cols-3">
				{[
					{
						description: "当前筛选条件下的名单人数",
						icon: Users,
						label: "匹配的用户",
						value: query.data?.total,
					},
					{
						description: "本页开发者的 GitHub 粉丝合计",
						icon: GitFork,
						label: "本页粉丝总数",
						value: query.data?.items.reduce(
							(sum, user) => sum + user.followers,
							0
						),
					},
					{
						description: "本页开发者的公开仓库合计",
						icon: FolderGit2,
						label: "本页公开仓库",
						value: query.data?.items.reduce(
							(sum, user) => sum + user.publicRepos,
							0
						),
					},
				].map(({ label, value, description, icon: Icon }) => (
					<Card className="rounded-xl py-5 shadow-xs" key={label}>
						<CardHeader>
							<CardTitle className="flex items-center justify-between">
								{label}
								<Icon className="size-4 text-muted-foreground" />
							</CardTitle>
							<CardDescription>{description}</CardDescription>
						</CardHeader>
						<CardContent>
							<p className="font-semibold text-3xl tabular-nums tracking-tight">
								{query.isError || value === undefined
									? "—"
									: NUMBER_FORMAT.format(value)}
							</p>
						</CardContent>
					</Card>
				))}
			</div>
			<div className="overflow-hidden rounded-xl border bg-card shadow-xs">
				<div className="flex items-center justify-between gap-3 border-b px-5 py-5">
					<div className="flex items-center gap-3">
						<h2 className="font-semibold text-base">所有开发者</h2>
						<Badge variant="secondary">
							{query.isError || !query.data
								? "—"
								: NUMBER_FORMAT.format(query.data.total)}
						</Badge>
					</div>
					<span className="text-muted-foreground text-xs">
						{selectedIds.length
							? `已选择 ${selectedIds.length} 位用户`
							: "发现 · 连接 · 管理"}
					</span>
				</div>
				<div className="flex flex-wrap items-end justify-between gap-4 border-b p-5">
					<search
						aria-label="筛选名单"
						className="flex min-w-0 flex-wrap items-end gap-4"
					>
						<KeywordForm key={q} onApply={applyFilters} q={q} />
						<TagSelect onApply={applyFilters} tag={tag} />
						<SortControls onApply={applyFilters} order={order} sort={sort} />
						<PageSizeSelect onApply={applyFilters} pageSize={pageSize} />
					</search>
					<BulkDeleteGithubUsersDialog
						ids={selectedIds}
						onDeleted={handleBulkDeleted}
					/>
				</div>
				<section
					aria-busy={query.isFetching}
					aria-label="GitHub 用户名单"
					className="flex min-w-0 flex-col transition-opacity data-[placeholder=true]:opacity-60"
					data-placeholder={query.isPlaceholderData}
				>
					<ListBody
						data={query.data}
						error={query.error}
						onDeleted={handleDeleted}
						onRetry={handleRetry}
						params={params}
						selection={rowSelection}
					/>
				</section>
			</div>
			<p className="text-center text-muted-foreground text-xs">
				你的名单保存在数据库中，点击同步可获取最新 GitHub 资料。
			</p>
		</div>
	);
}
