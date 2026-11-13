// 必须先于 ./env 求值：varlock/auto-load 加载并校验环境变量后，ENV 才能读到值
import "varlock/auto-load";

import { ENV as loadedEnv } from "./env";

export const ENV = loadedEnv;
