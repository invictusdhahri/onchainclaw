export const DEFAULT_BASE_URL = "https://api.onchainclaw.io";

/** Full request timeout (DNS, connect, TLS, response). */
export const DEFAULT_FETCH_TIMEOUT_MS = 25_000;

const UNDICI_TIMEOUT_CODES = new Set([
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
]);

function errnoCode(err: unknown): string | undefined {
  if (err && typeof err === "object" && "code" in err && typeof (err as { code: unknown }).code === "string") {
    return (err as { code: string }).code;
  }
  return undefined;
}

function walkErrorCauses(err: unknown, fn: (e: Error & { code?: string }) => void): void {
  let cur: unknown = err;
  const seen = new Set<unknown>();
  while (cur && typeof cur === "object" && !seen.has(cur)) {
    seen.add(cur);
    fn(cur as Error & { code?: string });
    cur = (cur as { cause?: unknown }).cause;
  }
}

/** True for DNS, TCP/TLS timeouts, and other low-level failures from `fetch`. */
export function isLikelyNetworkFailure(err: unknown): boolean {
  let bad = false;
  walkErrorCauses(err, (e) => {
    const name = e.name || "";
    const code = e.code ?? errnoCode(e);

    if (
      name === "ConnectTimeoutError" ||
      name === "HeadersTimeoutError" ||
      name === "BodyTimeoutError" ||
      name === "TimeoutError"
    ) {
      bad = true;
    }
    if (name === "AbortError") bad = true;
    if (code && UNDICI_TIMEOUT_CODES.has(code)) bad = true;
    if (code && ["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ETIMEDOUT", "ECONNRESET"].includes(code)) {
      bad = true;
    }
  });
  return bad;
}

export function formatNetworkFailureHelp(hostname: string): string {
  return [
    `✗ DNS or connection timed out for ${hostname}`,
    "",
    "Try switching your system DNS to 1.1.1.1 or 8.8.8.8.",
    "",
    "If you must use /etc/hosts, look up the current address first:",
    `  dig +short ${hostname} @1.1.1.1`,
    "",
    "Then add a line (replace <ip> with the result):",
    `  <ip> ${hostname}`,
  ].join("\n");
}

export class OnChainClawNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OnChainClawNetworkError";
  }
}

export class OnChainClawError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = "OnChainClawError";
  }
}

export async function apiFetch<T>(
  baseUrl: string,
  path: string,
  options: {
    method?: string;
    body?: unknown;
    apiKey?: string;
  } = {}
): Promise<T> {
  const { method = "GET", body, apiKey } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "onchainclaw-sdk/0.1.0",
  };
  if (apiKey) headers["x-api-key"] = apiKey;

  const hostname = new URL(baseUrl).hostname;
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(DEFAULT_FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    if (isLikelyNetworkFailure(err)) {
      throw new OnChainClawNetworkError(formatNetworkFailureHelp(hostname));
    }
    throw err;
  }

  const json = (await res.json().catch(() => ({}))) as unknown;

  if (!res.ok) {
    const msg =
      (json as Record<string, string>)?.message ||
      (json as Record<string, string>)?.error ||
      `HTTP ${res.status}`;
    throw new OnChainClawError(msg, res.status, json);
  }

  return json as T;
}
