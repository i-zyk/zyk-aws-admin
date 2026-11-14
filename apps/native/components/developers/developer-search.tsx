import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { searchKeywordSchema } from "@zyk-aws-admin/api/github/schemas";
import { router } from "expo-router";
import { Button, Card, Chip, useThemeColor } from "heroui-native";
import { useCallback, useState } from "react";
import { FlatList, Keyboard, Pressable, Text, View } from "react-native";

import { getAppErrorMessage } from "@/lib/app-error";
import type { GithubSearchItem } from "@/lib/github-users";
import { trpc } from "@/utils/trpc";
import { DataState, QueryProblem } from "./data-state";
import { DeveloperAvatar } from "./developer-card";
import { SearchField } from "./search-field";

function searchKey(item: GithubSearchItem) {
	return String(item.githubId);
}
function SearchResult({ user }: { user: GithubSearchItem }) {
	const muted = useThemeColor("muted");
	const open = useCallback(
		() =>
			router.push({
				params: user.savedId ? { id: user.savedId } : { username: user.login },
				pathname: "/modal",
			}),
		[user]
	);
	return (
		<Card className="rounded-3xl border border-border/60 p-5 shadow-none">
			<Card.Body>
				<Pressable
					accessibilityLabel={`查看 ${user.login} 的资料`}
					accessibilityRole="button"
					className="flex-row items-center gap-3"
					onPress={open}
				>
					<DeveloperAvatar login={user.login} src={user.avatarUrl} />
					<View className="flex-1 gap-2">
						<Card.Title>{user.login}</Card.Title>
						<View className="flex-row flex-wrap gap-2">
							{user.exactMatch ? (
								<Chip color="accent" size="sm" variant="soft">
									<Chip.Label>精确匹配</Chip.Label>
								</Chip>
							) : null}
							<Text className="text-muted text-xs">
								{user.savedId
									? "已在名单中 · 查看详情"
									: "查看完整资料并加入名单"}
							</Text>
						</View>
					</View>
					<Ionicons color={muted} name="chevron-forward" size={20} />
				</Pressable>
			</Card.Body>
		</Card>
	);
}
function renderResult({ item }: { item: GithubSearchItem }) {
	return <SearchResult user={item} />;
}

export function DeveloperSearch() {
	const [keyword, setKeyword] = useState("");
	const [q, setQ] = useState("");
	const [page, setPage] = useState(1);
	const [validation, setValidation] = useState("");
	const query = useQuery(
		trpc.githubUser.search.queryOptions(
			{ page, q },
			{ enabled: !!q, staleTime: 60_000 }
		)
	);
	const submit = useCallback(async () => {
		const parsed = searchKeywordSchema.safeParse(keyword);
		if (!parsed.success) {
			setValidation(parsed.error.issues[0]?.message ?? "请输入搜索关键字");
			return;
		}
		setValidation("");
		Keyboard.dismiss();
		if (q === parsed.data && page === 1) {
			await query.refetch();
		} else {
			setQ(parsed.data);
			setPage(1);
		}
	}, [keyword, page, q, query]);
	const retry = useCallback(async () => {
		await query.refetch();
	}, [query]);
	const previous = useCallback(
		() => setPage((current) => Math.max(1, current - 1)),
		[]
	);
	const next = useCallback(() => setPage((current) => current + 1), []);
	let empty = (
		<DataState
			description="支持用户名、昵称和 GitHub 搜索语法，例如 location:china。输入后点击搜索。"
			title="从一个名字开始探索"
		/>
	);
	if (q && !query.data && query.error) {
		empty = (
			<DataState
				action="重试"
				description={getAppErrorMessage(query.error)}
				onAction={retry}
				title="搜索暂时不可用"
			/>
		);
	} else if (q && !query.data && query.fetchStatus === "paused") {
		empty = (
			<DataState
				action="重试"
				description="连接网络后可继续搜索。"
				onAction={retry}
				title="当前处于离线状态"
			/>
		);
	} else if (q && !query.data) {
		empty = <DataState loading title="正在 GitHub 搜索…" />;
	} else if (q && query.data) {
		empty = (
			<DataState
				description="换一个用户名或关键字再试试。"
				title="没有找到匹配的用户"
			/>
		);
	}
	return (
		<FlatList
			className="flex-1 bg-background"
			contentContainerStyle={{ gap: 14, padding: 20, paddingBottom: 28 }}
			contentInsetAdjustmentBehavior="automatic"
			data={q ? (query.data?.items ?? []) : []}
			keyboardShouldPersistTaps="handled"
			keyExtractor={searchKey}
			ListEmptyComponent={empty}
			ListFooterComponent={
				query.data ? (
					<View className="flex-row items-center justify-between gap-3 pt-3">
						<Button
							isDisabled={page <= 1 || query.isFetching}
							onPress={previous}
							variant="secondary"
						>
							上一页
						</Button>
						<Text className="text-muted text-xs">第 {page} 页</Text>
						<Button
							isDisabled={!query.data.hasMore || query.isFetching}
							onPress={next}
							variant="secondary"
						>
							下一页
						</Button>
					</View>
				) : null
			}
			ListHeaderComponent={
				<View className="gap-5 pb-2">
					<View className="gap-2">
						<Text className="font-medium text-accent text-xs tracking-[2px]">
							FIND YOUR INSPIRATION
						</Text>
						<Text className="font-bold text-[30px] text-foreground leading-[42px]">
							下一位，值得关注的人。
						</Text>
						<Text className="text-muted text-sm leading-6">
							搜索 GitHub 公开用户，查看资料并加入共享名单。
						</Text>
					</View>
					<SearchField
						busy={query.isFetching}
						onChange={setKeyword}
						onSubmit={submit}
						placeholder="输入 GitHub 用户名或昵称…"
						value={keyword}
					/>
					{validation ? (
						<Text
							accessibilityLiveRegion="polite"
							className="text-danger text-sm"
						>
							{validation}
						</Text>
					) : null}
					{q ? (
						<Text className="text-muted text-sm">
							{query.data
								? `找到 ${query.data.total.toLocaleString()} 位用户（最多浏览前 1,000 条）`
								: "正在查询 GitHub…"}
						</Text>
					) : null}
					{query.data && query.error ? (
						<QueryProblem error={query.error} onRetry={retry} />
					) : null}
				</View>
			}
			renderItem={renderResult}
		/>
	);
}
