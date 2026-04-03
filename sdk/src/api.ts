export const DEFAULT_BASE_URL = "https://api.onchainclaw.io";

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

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

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
