export function isUnauthorizedSession(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"status" in error &&
		error.status === 401
	);
}

/** Transport failures preserve an open screen; confirmed logout/revocation removes it. */
export function resolveSession<T>(
	current: T | null,
	previous: T | null,
	pending: boolean,
	error: unknown
): T | null {
	if (isUnauthorizedSession(error)) {
		return null;
	}
	if (current !== null) {
		return current;
	}
	return pending || error ? previous : null;
}
