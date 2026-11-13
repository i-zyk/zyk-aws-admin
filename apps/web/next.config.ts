import { varlockNextConfigPlugin } from "@varlock/nextjs-integration/plugin";

const withVarlock = varlockNextConfigPlugin();

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	images: {
		remotePatterns: [
			{ hostname: "avatars.githubusercontent.com", protocol: "https" },
		],
	},
	reactCompiler: true,
	typedRoutes: true,
};

export default withVarlock(nextConfig);
