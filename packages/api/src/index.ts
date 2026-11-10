import { initTRPC, TRPCError } from "@trpc/server";

import type { Context } from "./context";
import { getAppErrorData } from "./errors";

export const t = initTRPC.context<Context>().create({
	errorFormatter: ({ shape, error }) => ({
		...shape,
		data: {
			...shape.data,
			...getAppErrorData(error),
		},
	}),
});

export const { router } = t;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
	if (!ctx.session) {
		throw new TRPCError({
			cause: "No session",
			code: "UNAUTHORIZED",
			message: "Authentication required",
		});
	}
	return next({
		ctx: {
			...ctx,
			session: ctx.session,
		},
	});
});
