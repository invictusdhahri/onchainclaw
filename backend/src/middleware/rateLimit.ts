import { rateLimit } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redis } from "../lib/redis.js";
import type { Request, Response } from "express";

const REDIS_URL = process.env.REDIS_URL;

const TRUST_PROXY_HOPS = parseInt(process.env.TRUST_PROXY_HOPS || "1", 10);

const RATE_LIMIT_API_WINDOW_MS = parseInt(
  process.env.RATE_LIMIT_API_WINDOW_MS || "900000",
  10
);
const RATE_LIMIT_API_MAX = parseInt(
  process.env.RATE_LIMIT_API_MAX || "800",
  10
);

const RATE_LIMIT_WRITE_MAX = parseInt(
  process.env.RATE_LIMIT_WRITE_MAX || "120",
  10
);

const RATE_LIMIT_REGISTER_MAX = parseInt(
  process.env.RATE_LIMIT_REGISTER_MAX || "200",
  10
);

const RATE_LIMIT_PNL_MAX = parseInt(
  process.env.RATE_LIMIT_PNL_MAX || "200",
  10
);

function standardRateLimitHandler(req: Request, res: Response) {
  res.status(429).json({
    error: "Too many requests",
    message: "Rate limit exceeded. Please try again later.",
  });
}

export const apiBaselineLimiter = rateLimit({
  windowMs: RATE_LIMIT_API_WINDOW_MS,
  max: RATE_LIMIT_API_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  store: REDIS_URL
    ? new RedisStore({
        sendCommand: (...args: string[]) => redis.call(...args),
        prefix: "rl:api:",
      })
    : undefined,
  skip: (req: Request) => {
    return req.path.startsWith("/webhook");
  },
  handler: standardRateLimitHandler,
});

export const writeLimiter = rateLimit({
  windowMs: RATE_LIMIT_API_WINDOW_MS,
  max: RATE_LIMIT_WRITE_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  store: REDIS_URL
    ? new RedisStore({
        sendCommand: (...args: string[]) => redis.call(...args),
        prefix: "rl:write:",
      })
    : undefined,
  handler: standardRateLimitHandler,
});

export const registerLimiter = rateLimit({
  windowMs: 3600000,
  max: RATE_LIMIT_REGISTER_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  store: REDIS_URL
    ? new RedisStore({
        sendCommand: (...args: string[]) => redis.call(...args),
        prefix: "rl:register:",
      })
    : undefined,
  handler: standardRateLimitHandler,
});

export const pnlLimiter = rateLimit({
  windowMs: RATE_LIMIT_API_WINDOW_MS,
  max: RATE_LIMIT_PNL_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  store: REDIS_URL
    ? new RedisStore({
        sendCommand: (...args: string[]) => redis.call(...args),
        prefix: "rl:pnl:",
      })
    : undefined,
  handler: standardRateLimitHandler,
});
