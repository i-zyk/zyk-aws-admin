import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import type {
	GithubUserListOrder,
	GithubUserListSort,
} from "@zyk-aws-admin/api/github/schemas";
import { router } from "expo-router";
import { Button, useThemeColor, useToast } from "heroui-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	Alert,
	FlatList,
	Keyboard,
	Pressable,
	ScrollView,
	Text,
	View,
} from "react-native";

import { getAppErrorMessage } from "@/lib/app-error";
import { type GithubRecord, refreshAfterDelete } from "@/lib/github-users";
import { trpc } from "@/utils/trpc";
import { DataState, QueryProblem } from "./data-state";
import { DeveloperCard } from "./developer-card";
import { SearchField } from "./search-field";

const PAGE_SIZE = 20;
const SORTS: { label: string; value: GithubUserListSort }[] = [
	{ label: "最新添加", value: "createdAt" },
	{ label: "粉丝数", value: "followers" },
	{ label: "最近同步", value: "syncedAt" },
];
function goDiscover() {
	router.push("/(drawer)/(tabs)/two");
}
function developerKey(item: GithubRecord) {
	return String(item.id);
}

export function FilterChip({
	label,
	value,
	selected,
	onSelect,
}: {
	label: string;
	value: string;
	selected: boolean;
	onSelect: (value: string) => void;
}) {
	const onPress = useCallback(() => onSelect(value), [onSelect, value]);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ selected }}
			className={
				selected
					? "min-h-11 items-center justify-center rounded-full bg-accent px-5"
					: "min-h-11 items-center justify-center rounded-full border border-border bg-surface px-5"
			}
			onPress={onPress}
		>
			<Text
				className={
					selected
						? "font-medium text-accent-foreground text-sm"
						: "text-muted text-sm"
				}
			>
				{label}
			</Text>
		</Pressable>
	);
}

function ListEmpty({
	query,
	hasFilters,
	retry,
	reset,
}: {
	query: ReturnType<typeof useListQuery>;
	hasFilters: boolean;
	retry: () => void;
	reset: () => void;
}) {
	let empty = (
		<DataState
			action={hasFilters ? "清除筛选" : "去发现开发者"}
			description={
				hasFilters
					? "试试其他关键词或标签。"
					: "搜索 GitHub 用户并加入名单，资料会保存在数据库中。"
			}
			onAction={hasFilters ? reset : goDiscover}
			title={hasFilters ? "没有匹配的开发者" : "从第一位开发者开始"}
		/>
	);
	if (!query.data && query.isError) {
		empty = (
			<DataState
				action="重试"
				description={getAppErrorMessage(query.error)}
				onAction={retry}
				title="名单暂时无法加载"
			/>
		);
	} else if (!query.data && query.fetchStatus === "paused") {
		empty = (
			<DataState
				action="重试"
				description="连接网络后会自动继续加载。"
				onAction={retry}
				title="当前处于离线状态"
			/>
		);
	} else if (!query.data) {
		empty = <DataState loading title="正在加载开发者名单…" />;
	}
	return empty;
}

function useListQuery(
	input: Parameters<typeof trpc.githubUser.list.queryOptions>[0]
) {
	return useQuery(trpc.githubUser.list.queryOptions(input));
}

function useDeveloperList() {
	const [keyword, setKeyword] = useState("");
	const [q, setQ] = useState("");
	const [tag, setTag] = useState("");
	const [sort, setSort] = useState<GithubUserListSort>("createdAt");
	const [order, setOrder] = useState<GithubUserListOrder>("desc");
	const [page, setPage] = useState(1);
	const [accentForeground] = useThemeColor(["accent-foreground"]);
	const { toast } = useToast();
	const deleting = useRef<boolean>(false);
	const query = useListQuery({
		order,
		page,
		pageSize: PAGE_SIZE,
		q: q || undefined,
		sort,
		tag: tag || undefined,
	});
	const tagsQuery = useQuery(
		trpc.githubUser.tags.queryOptions(undefined, { staleTime: 60_000 })
	);
	const scope = JSON.stringify([q, tag, sort, order, page]);
	const [selection, setSelection] = useState<{
		scope: string;
		ids: number[];
		active: boolean;
	}>({ active: false, ids: [], scope });
	if (selection.scope !== scope) {
		setSelection({ active: false, ids: [], scope });
	}
	const selectedIds =
		selection.scope === scope
			? selection.ids.filter((id) =>
					query.data?.items.some((item) => item.id === id)
				)
			: [];
	const selecting = selection.scope === scope && selection.active;
	const totalPages = Math.max(
		1,
		Math.ceil((query.data?.total ?? 0) / PAGE_SIZE)
	);
	useEffect(() => {
		if (
			!query.isFetching &&
			query.data &&
			page > 1 &&
			!query.data.items.length &&
			query.data.total > 0
		) {
			setPage(Math.max(1, Math.ceil(query.data.total / PAGE_SIZE)));
		}
	}, [page, query.data, query.isFetching]);
	const deletion = useMutation(
		trpc.githubUser.deleteMany.mutationOptions({
			onSettled: () => {
				deleting.current = false;
			},
			onSuccess: async ({ count }) => {
				setSelection({ active: false, ids: [], scope });
				await refreshAfterDelete();
				toast.show({ label: `已删除 ${count} 位开发者`, variant: "success" });
			},
		})
	);
	const submit = useCallback(async () => {
		Keyboard.dismiss();
		setPage(1);
		if (q === keyword.trim() && page === 1) {
			await query.refetch();
		} else {
			setQ(keyword.trim());
		}
	}, [keyword, page, q, query]);
	const reset = useCallback(() => {
		setKeyword("");
		setQ("");
		setTag("");
		setPage(1);
	}, []);
	const setFilter = useCallback((value: string) => {
		setTag(value);
		setPage(1);
	}, []);
	const setSortValue = useCallback((value: string) => {
		const item = SORTS.find((option) => option.value === value);
		if (item) {
			setSort(item.value);
			setPage(1);
		}
	}, []);
	const toggleOrder = useCallback(() => {
		setOrder((current) => (current === "desc" ? "asc" : "desc"));
		setPage(1);
	}, []);
	const retry = useCallback(async () => {
		await query.refetch();
	}, [query]);
	const retryTags = useCallback(async () => {
		await tagsQuery.refetch();
	}, [tagsQuery]);
	const previous = useCallback(
		() => setPage((current) => Math.max(1, current - 1)),
		[]
	);
	const next = useCallback(() => setPage((current) => current + 1), []);
	const toggleSelection = useCallback(
		() =>
			setSelection((current) => ({ active: !current.active, ids: [], scope })),
		[scope]
	);
	const toggle = useCallback(
		(id: number) => {
			setSelection((current) => ({
				active: true,
				ids: current.ids.includes(id)
					? current.ids.filter((item) => item !== id)
					: [...current.ids, id],
				scope,
			}));
		},
		[scope]
	);
	const selectAll = useCallback(() => {
		setSelection({
			active: true,
			ids: query.data?.items.map((item) => item.id) ?? [],
			scope,
		});
	}, [query.data, scope]);
	const deleteSelected = useCallback(() => {
		if (deletion.isPending || !selectedIds.length) {
			return;
		}
		Alert.alert(
			`删除 ${selectedIds.length} 位开发者？`,
			"删除后无法恢复，备注和标签也会一起删除。",
			[
				{ style: "cancel", text: "取消" },
				{
					onPress: () => {
						if (!deleting.current) {
							deleting.current = true;
							deletion.mutate({ ids: selectedIds });
						}
					},
					style: "destructive",
					text: "删除",
				},
			]
		);
	}, [deletion, selectedIds]);
	const renderDeveloper = useCallback(
		({ item }: { item: GithubRecord }) => (
			<DeveloperCard
				developer={item}
				disabled={deletion.isPending}
				onToggle={toggle}
				selected={selectedIds.includes(item.id)}
				selecting={selecting}
			/>
		),
		[deletion.isPending, selectedIds, selecting, toggle]
	);
	const hasFilters = Boolean(q || tag);
	return {
		accentForeground,
		deleteSelected,
		deletion,
		hasFilters,
		keyword,
		next,
		order,
		page,
		previous,
		query,
		renderDeveloper,
		reset,
		retry,
		retryTags,
		selectAll,
		selectedIds,
		selecting,
		setFilter,
		setKeyword,
		setSortValue,
		sort,
		submit,
		tag,
		tagsQuery,
		toggleOrder,
		toggleSelection,
		totalPages,
	};
}

type ListController = ReturnType<typeof useDeveloperList>;
function ListHeader({ state }: { state: ListController }) {
	const {
		query,
		tagsQuery,
		deletion,
		retry,
		hasFilters,
		accentForeground,
		keyword,
		setKeyword,
		submit,
		setFilter,
		tag,
		retryTags,
		setSortValue,
		sort,
		toggleOrder,
		order,
		toggleSelection,
		selecting,
		selectedIds,
		selectAll,
		deleteSelected,
	} = state;
	return (
		<View className="gap-5 pb-2">
			<View className="gap-2">
				<Text className="font-medium text-accent text-xs tracking-[2px]">
					YOUR DEVELOPER CIRCLE
				</Text>
				<Text className="font-bold text-[30px] text-foreground leading-[42px]">
					把优秀的人，{"\n"}留在身边。
				</Text>
				<Text className="text-muted text-sm leading-6">
					浏览团队共享名单，记录每一位值得关注的开发者。
				</Text>
			</View>
			<View className="flex-row items-center justify-between rounded-3xl bg-accent px-5 py-5">
				<View className="gap-1">
					<Text className="text-accent-foreground/80 text-xs">
						{hasFilters ? "匹配的开发者" : "已保存的开发者"}
					</Text>
					<Text className="font-bold text-3xl text-accent-foreground">
						{query.data?.total ?? "—"}
						<Text className="font-normal text-sm"> 位</Text>
					</Text>
				</View>
				<Button
					accessibilityLabel="发现更多开发者"
					isIconOnly
					onPress={goDiscover}
					variant="ghost"
				>
					<Ionicons color={accentForeground} name="arrow-forward" size={26} />
				</Button>
			</View>
			<SearchField
				busy={query.isFetching}
				onChange={setKeyword}
				onSubmit={submit}
				placeholder="搜索姓名、用户名、公司或备注…"
				value={keyword}
			/>
			<ScrollView
				contentContainerStyle={{ gap: 8 }}
				horizontal
				showsHorizontalScrollIndicator={false}
			>
				<FilterChip
					label="全部标签"
					onSelect={setFilter}
					selected={!tag}
					value=""
				/>
				{[...new Set([...(tagsQuery.data ?? []), ...(tag ? [tag] : [])])].map(
					(value) => (
						<FilterChip
							key={value}
							label={value}
							onSelect={setFilter}
							selected={tag === value}
							value={value}
						/>
					)
				)}
			</ScrollView>
			{tagsQuery.error ? (
				<QueryProblem error={tagsQuery.error} onRetry={retryTags} />
			) : null}
			<View className="flex-row flex-wrap items-center gap-2">
				{SORTS.map((item) => (
					<FilterChip
						key={item.value}
						label={item.label}
						onSelect={setSortValue}
						selected={sort === item.value}
						value={item.value}
					/>
				))}
				<Button
					accessibilityLabel="切换排序方向"
					onPress={toggleOrder}
					size="sm"
					variant="ghost"
				>
					{order === "desc" ? "降序 ↓" : "升序 ↑"}
				</Button>
			</View>
			<View className="flex-row items-center justify-between">
				<Text className="font-semibold text-foreground text-lg">用户名单</Text>
				<Button
					isDisabled={deletion.isPending || !query.data?.items.length}
					onPress={toggleSelection}
					size="sm"
					variant="ghost"
				>
					{selecting ? "取消选择" : "批量管理"}
				</Button>
			</View>
			{selecting ? (
				<View className="flex-row flex-wrap items-center gap-2">
					<Text className="flex-1 text-muted text-sm">
						已选择 {selectedIds.length} 位
					</Text>
					<Button
						isDisabled={deletion.isPending}
						onPress={selectAll}
						size="sm"
						variant="secondary"
					>
						全选本页
					</Button>
					<Button
						isDisabled={deletion.isPending || !selectedIds.length}
						onPress={deleteSelected}
						size="sm"
						variant="danger-soft"
					>
						{deletion.isPending ? "正在删除…" : "删除所选"}
					</Button>
				</View>
			) : null}
			{deletion.error && selecting && selectedIds.length > 0 ? (
				<QueryProblem error={deletion.error} onRetry={deleteSelected} />
			) : null}
			{query.data && query.error ? (
				<QueryProblem error={query.error} onRetry={retry} />
			) : null}
		</View>
	);
}

export function DeveloperList() {
	const state = useDeveloperList();
	const {
		query,
		page,
		deletion,
		retry,
		renderDeveloper,
		hasFilters,
		reset,
		previous,
		next,
		totalPages,
	} = state;
	return (
		<FlatList
			className="flex-1 bg-background"
			contentContainerStyle={{ gap: 14, padding: 20, paddingBottom: 28 }}
			contentInsetAdjustmentBehavior="automatic"
			data={query.data?.items ?? []}
			keyboardShouldPersistTaps="handled"
			keyExtractor={developerKey}
			ListEmptyComponent={
				<ListEmpty
					hasFilters={hasFilters}
					query={query}
					reset={reset}
					retry={retry}
				/>
			}
			ListFooterComponent={
				query.data ? (
					<View className="gap-4 pt-3">
						<View className="flex-row items-center justify-between gap-3">
							<Button
								isDisabled={page <= 1 || query.isFetching || deletion.isPending}
								onPress={previous}
								variant="secondary"
							>
								上一页
							</Button>
							<Text className="text-muted text-xs">
								第 {page} / {totalPages} 页
							</Text>
							<Button
								isDisabled={
									page >= totalPages || query.isFetching || deletion.isPending
								}
								onPress={next}
								variant="secondary"
							>
								下一页
							</Button>
						</View>
						<Text className="text-center text-muted text-xs">
							每页 {PAGE_SIZE} 位 · 下拉刷新名单
						</Text>
					</View>
				) : null
			}
			ListHeaderComponent={<ListHeader state={state} />}
			onRefresh={retry}
			refreshing={query.isFetching && !!query.data}
			renderItem={renderDeveloper}
		/>
	);
}
