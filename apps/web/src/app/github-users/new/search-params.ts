const MAX_SEARCH_PAGE = 100;

export function parseSearchPage(value: string | string[] | undefined): number {
	if (typeof value !== "string") {
		return 1;
	}
	const page = Number(value);
	return Number.isInteger(page) && page >= 1 && page <= MAX_SEARCH_PAGE
		? page
		: 1;
}

export function searchHref(q: string, page: number, username?: string) {
	const params = new URLSearchParams({ page: String(page), q });
	if (username) {
		params.set("username", username);
	}
	return `/github-users/new?${params.toString()}` as const;
}
