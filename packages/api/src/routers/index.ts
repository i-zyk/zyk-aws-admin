import { protectedProcedure, publicProcedure, router } from "../index";
import { githubUserRouter } from "./github-user";

export const appRouter = router({
	githubUser: githubUserRouter,
	healthCheck: publicProcedure.query(() => "OK"),
	privateData: protectedProcedure.query(({ ctx }) => ({
		message: "This is private",
		user: ctx.session.user,
	})),
});
export type AppRouter = typeof appRouter;
