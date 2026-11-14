import assert from "node:assert/strict";
import { test } from "node:test";

import { isUnauthorizedSession, resolveSession } from "../lib/session-state.ts";

const existingUser = { user: { id: "existing-user" } };

test("cold startup does not invent an authenticated session", () => {
	assert.equal(resolveSession(null, null, true, null), null);
});

test("background refresh keeps the authenticated screen while pending", () => {
	assert.equal(resolveSession(null, existingUser, true, null), existingUser);
});

test("a transport failure preserves the session and open editor", () => {
	assert.equal(
		resolveSession(
			null,
			existingUser,
			false,
			new Error("Network request failed")
		),
		existingUser
	);
});

test("confirmed logout or revocation removes the previous session", () => {
	assert.equal(resolveSession(null, existingUser, false, null), null);
});

test("an unauthorized response cannot fall back to cached authentication", () => {
	assert.equal(isUnauthorizedSession({ status: 401 }), true);
	assert.equal(
		resolveSession(null, existingUser, false, { status: 401 }),
		null
	);
});

test("a newly authenticated identity wins over the old cached identity", () => {
	const newUser = { user: { id: "new-user" } };
	assert.equal(resolveSession(newUser, existingUser, false, null), newUser);
});
