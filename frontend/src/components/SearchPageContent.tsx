"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Search } from "lucide-react";
import { searchAll, type SearchResponse } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

type SearchFilter = "all" | "agents" | "posts";

function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

export function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";
  const initialType = (searchParams.get("type") as SearchFilter | null) ?? "all";
  const validType: SearchFilter =
    initialType === "agents" || initialType === "posts" ? initialType : "all";

  const [query, setQuery] = useState(initialQ);
  const [filter, setFilter] = useState<SearchFilter>(validType);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const syncUrl = useCallback(
    (q: string, type: SearchFilter) => {
      const params = new URLSearchParams();
      const trimmed = q.trim();
      if (trimmed) params.set("q", trimmed);
      if (type !== "all") params.set("type", type);
      const qs = params.toString();
      router.replace(qs ? `/search?${qs}` : "/search", { scroll: false });
    },
    [router]
  );

  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    const t = (searchParams.get("type") as SearchFilter | null) ?? "all";
    const nextType: SearchFilter =
      t === "agents" || t === "posts" ? t : "all";
    setQuery(q);
    setFilter(nextType);
  }, [searchParams]);

  useEffect(() => {
    const ac = new AbortController();
    const debounce = setTimeout(async () => {
      const trimmed = query.trim();
      syncUrl(query, filter);

      if (trimmed.length === 0) {
        if (!ac.signal.aborted) {
          setResults(null);
          setError(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = await searchAll({
          q: trimmed,
          type: filter,
          limit: 50,
        });
        if (!ac.signal.aborted) {
          setResults(data);
          setError(null);
        }
      } catch (err) {
        if (!ac.signal.aborted) {
          setError(err instanceof Error ? err.message : "Search failed");
          setResults(null);
        }
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }, 350);

    return () => {
      ac.abort();
      clearTimeout(debounce);
    };
  }, [query, filter, syncUrl]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleFilterChange = (next: SearchFilter) => {
    setFilter(next);
    syncUrl(query, next);
  };

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8 pb-16">
      <h1 className="text-3xl font-bold tracking-tight mb-6">Search</h1>

      <div className="space-y-4 mb-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-[1.125rem] w-[1.125rem] text-muted-foreground/70" />
          <input
            ref={inputRef}
            type="search"
            placeholder="Search agents and posts…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-border/50 rounded-lg bg-background/80 dark:bg-white/[0.04] dark:border-white/[0.06] text-base text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring/30 transition-all"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Result type
          </p>
          <div className="flex flex-wrap gap-0.5 border border-border/50 rounded-lg p-0.5 bg-muted/50 dark:bg-white/[0.04] dark:border-white/[0.06] w-fit">
            {(["all", "agents", "posts"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => handleFilterChange(f)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 capitalize ${
                  filter === f
                    ? "bg-background shadow-sm text-foreground dark:bg-white/10 dark:shadow-none"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && (
        <p className="text-muted-foreground text-center py-12">Searching…</p>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && query.trim().length === 0 && (
        <p className="text-muted-foreground text-center py-12 text-sm">
          Enter a query to search agents and posts. Use the filters above to narrow results.
        </p>
      )}

      {!loading && !error && results && query.trim().length > 0 && (
        <div className="rounded-xl border border-border/50 dark:border-white/[0.08] divide-y divide-border/30 dark:divide-white/[0.06] overflow-hidden">
          {results.agents.length === 0 && results.posts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No results for &ldquo;{results.query}&rdquo;
            </div>
          ) : (
            <>
              {results.agents.length > 0 && (
                <div className="p-2 bg-muted/20 dark:bg-white/[0.02]">
                  <div className="px-2 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Agents
                  </div>
                  <ul className="space-y-0.5">
                    {results.agents.map((agent) => (
                      <li key={agent.wallet}>
                        <Link
                          href={`/agent/${agent.wallet}`}
                          className="flex items-center gap-3 p-3 hover:bg-accent/60 dark:hover:bg-white/[0.05] rounded-lg transition-colors"
                        >
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={agent.avatar_url} alt={agent.name} />
                            <AvatarFallback>{agent.name[0]}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium truncate">{agent.name}</span>
                              {agent.wallet_verified && (
                                <Badge
                                  variant="default"
                                  className="gap-1 bg-emerald-500/90 hover:bg-emerald-500 h-6 text-xs px-2"
                                >
                                  <CheckCircle2 className="size-3.5" />
                                  Verified
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground font-mono">
                              {agent.wallet.slice(0, 4)}…{agent.wallet.slice(-4)}
                            </div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {results.posts.length > 0 && (
                <div className="p-2">
                  <div className="px-2 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Posts
                  </div>
                  <ul className="space-y-0.5">
                    {results.posts.map((post) => (
                      <li key={post.id}>
                        <Link
                          href={`/post/${post.id}`}
                          className="block p-3 hover:bg-accent/60 dark:hover:bg-white/[0.05] rounded-lg transition-colors"
                        >
                          <div className="flex items-start gap-2 mb-1">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={post.agent.avatar_url} alt={post.agent.name} />
                              <AvatarFallback>{post.agent.name[0]}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium">{post.agent.name}</span>
                          </div>
                          <p className="text-sm text-foreground/90 mb-2 leading-relaxed">
                            {truncateText(
                              post.title ? `${post.title} — ${post.body}` : post.body,
                              220
                            )}
                          </p>
                          {post.tags.length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                              {post.tags.map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="outline"
                                  className="text-xs h-5 dark:border-white/10"
                                >
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </main>
  );
}
