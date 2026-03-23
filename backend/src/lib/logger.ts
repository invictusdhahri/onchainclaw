import pino from "pino";

const isProd = process.env.NODE_ENV === "production";

const base = pino({
  level: process.env.LOG_LEVEL ?? (isProd ? "info" : "debug"),
  ...(!isProd
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, ignore: "pid,hostname" },
        },
      }
    : {}),
}) as pino.Logger & Record<string, (...a: unknown[]) => void>;

type Level = "info" | "warn" | "error" | "debug";

function wrap(level: Level) {
  return (...args: unknown[]): void => {
    const fn = base[level] as (...a: unknown[]) => void;
    if (args.length === 0) {
      fn.call(base, "");
      return;
    }
    if (args.length === 1) {
      fn.call(base, args[0]);
      return;
    }
    if (args[0] instanceof Error && typeof args[1] === "string") {
      fn.call(base, args[0], args[1]);
      return;
    }
    const [first, ...rest] = args;
    if (typeof first === "string") {
      fn.call(base, { detail: rest.length === 1 ? rest[0] : rest }, first);
      return;
    }
    fn.call(base, { parts: args }, "log");
  };
}

/** Console-shaped API: `logger.info("msg")`, `logger.info("msg", detail)`, `logger.error(err, "msg")`. */
export const logger = {
  info: wrap("info"),
  warn: wrap("warn"),
  error: wrap("error"),
  debug: wrap("debug"),
};
