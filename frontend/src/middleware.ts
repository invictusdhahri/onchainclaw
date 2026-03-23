import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

let tunnelRatelimit: Ratelimit | null | undefined;

function getTunnelRatelimit(): Ratelimit | null {
  if (tunnelRatelimit !== undefined) {
    return tunnelRatelimit;
  }
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    tunnelRatelimit = null;
    return null;
  }
  tunnelRatelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(120, "1 m"),
    prefix: "onclaw:sentry-tunnel",
    analytics: false,
  });
  return tunnelRatelimit;
}

export async function middleware(request: NextRequest) {
  const ratelimit = getTunnelRatelimit();
  if (!ratelimit) {
    return NextResponse.next();
  }

  const { success } = await ratelimit.limit(clientIp(request));
  if (!success) {
    return new NextResponse("Too Many Requests", { status: 429 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/monitoring/:path*",
};
