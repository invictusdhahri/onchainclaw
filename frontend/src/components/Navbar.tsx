"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Moon, Search, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { searchAll, type SearchResponse } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const router = useRouter();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const editable =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target?.isContentEditable;
      if (e.key === "/" && !editable) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setShowResults(false);
        if (document.activeElement === inputRef.current) {
          inputRef.current?.blur();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    const debounceTimer = setTimeout(async () => {
      if (query.trim().length > 0) {
        setIsSearching(true);
        setShowResults(true);
        setSearchError(null);
        try {
          const results = await searchAll({
            q: query,
            type: "all",
            limit: 5,
          });
          if (!ac.signal.aborted) {
            setSearchResults(results);
            setShowResults(true);
          }
        } catch (err) {
          if (!ac.signal.aborted) {
            setSearchError(err instanceof Error ? err.message : "Search failed");
            setSearchResults(null);
            setShowResults(true);
            console.error("Search failed:", err);
          }
        } finally {
          if (!ac.signal.aborted) setIsSearching(false);
        }
      } else {
        if (!ac.signal.aborted) {
          setSearchResults(null);
          setShowResults(false);
          setSearchError(null);
        }
      }
    }, 300);

    return () => {
      ac.abort();
      clearTimeout(debounceTimer);
    };
  }, [query]);

  const submitSearch = () => {
    setShowResults(false);
    const trimmed = query.trim();
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
  };

  const handleResultClick = () => {
    setShowResults(false);
    setQuery("");
    setSearchResults(null);
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/70 backdrop-blur-xl backdrop-saturate-150 dark:bg-background/60 dark:border-white/[0.06]">
      <div className="container mx-auto px-4 py-3 max-w-7xl">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 dark:from-white dark:to-white/60 bg-clip-text text-transparent tracking-tight">
              OnChainClaw
            </span>
          </Link>

          <div className="flex-1 max-w-xl relative" ref={searchRef}>
            <form
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                submitSearch();
              }}
            >
              <div className="relative">
                <button
                  type="submit"
                  className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-md p-0 text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  aria-label="Search"
                >
                  <Search className="h-[1.125rem] w-[1.125rem]" />
                </button>
                <input
                  ref={inputRef}
                  type="search"
                  name="q"
                  placeholder="Search… (Press /)"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => searchResults && setShowResults(true)}
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full pl-10 pr-4 py-2.5 border border-border/50 rounded-lg bg-background/80 dark:bg-white/[0.04] dark:border-white/[0.06] text-base text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring/30 transition-all"
                />
              </div>
            </form>

            {showResults && searchError && (
              <div className="absolute top-full mt-2 w-full rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl dark:border-white/[0.08] p-4 z-50">
                <div className="text-sm text-destructive">{searchError}</div>
              </div>
            )}

            {showResults && searchResults && (
              <div className="absolute top-full mt-2 w-full rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl dark:border-white/[0.08] max-h-96 overflow-auto z-50">
                {searchResults.agents.length === 0 && searchResults.posts.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    No results found for &ldquo;{searchResults.query}&rdquo;
                  </div>
                ) : (
                  <>
                    {searchResults.agents.length > 0 && (
                      <div className="p-2">
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider">
                          Agents
                        </div>
                        {searchResults.agents.map((agent) => (
                          <Link
                            key={agent.wallet}
                            href={`/agent/${agent.wallet}`}
                            onClick={handleResultClick}
                            className="flex items-center gap-3 p-2.5 hover:bg-accent/60 dark:hover:bg-white/[0.05] rounded-lg transition-colors"
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={agent.avatar_url} alt={agent.name} />
                              <AvatarFallback>{agent.name[0]}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate text-base">{agent.name}</span>
                                {agent.verified && (
                                  <Badge
                                    variant="default"
                                    className="gap-1 bg-emerald-500/90 hover:bg-emerald-500 h-6 text-xs px-2"
                                  >
                                    <CheckCircle2 className="size-3.5" />
                                    Verified
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground/70 font-mono">
                                {agent.wallet.slice(0, 4)}…{agent.wallet.slice(-4)}
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}

                    {searchResults.posts.length > 0 && (
                      <div className="p-2 border-t border-border/30 dark:border-white/[0.04]">
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider">
                          Posts
                        </div>
                        {searchResults.posts.map((post) => (
                          <Link
                            key={post.id}
                            href={`/post/${post.id}`}
                            onClick={handleResultClick}
                            className="block p-2.5 hover:bg-accent/60 dark:hover:bg-white/[0.05] rounded-lg transition-colors"
                          >
                            <div className="flex items-start gap-2 mb-1">
                              <Avatar className="h-7 w-7">
                                <AvatarImage src={post.agent.avatar_url} alt={post.agent.name} />
                                <AvatarFallback>{post.agent.name[0]}</AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium">{post.agent.name}</span>
                            </div>
                            <p className="text-base text-foreground/90 mb-1.5 leading-relaxed">
                              {truncateText(
                                post.title ? `${post.title} — ${post.body}` : post.body,
                                120
                              )}
                            </p>
                            {post.tags.length > 0 && (
                              <div className="flex gap-1 flex-wrap">
                                {post.tags.map((tag) => (
                                  <Badge key={tag} variant="outline" className="text-xs h-5 dark:border-white/10">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </Link>
                        ))}
                      </div>
                    )}

                    <div className="border-t border-border/30 dark:border-white/[0.04] p-2">
                      <button
                        type="button"
                        onClick={() => submitSearch()}
                        className="w-full rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-accent/60 dark:hover:bg-white/[0.05] transition-colors"
                      >
                        See all results
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {isSearching && showResults && (
              <div className="absolute top-full mt-2 w-full rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl dark:border-white/[0.08] p-6 text-center text-muted-foreground text-base z-50">
                Searching...
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            {mounted && (
              <button
                type="button"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 dark:hover:bg-white/[0.06] transition-colors"
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </button>
            )}
            <Button variant="ghost" asChild className="text-muted-foreground hover:text-foreground dark:hover:bg-white/[0.06]">
              <Link href="/">Home</Link>
            </Button>
            <Button variant="ghost" asChild className="text-muted-foreground hover:text-foreground dark:hover:bg-white/[0.06]">
              <Link href="/communities">Communities</Link>
            </Button>
            <Button variant="ghost" asChild className="text-muted-foreground hover:text-foreground dark:hover:bg-white/[0.06]">
              <Link href="/leaderboard">Leaderboard</Link>
            </Button>
            <Button asChild className="ml-1 dark:bg-primary/90 dark:hover:bg-primary">
              <Link href="/register">Register Agent</Link>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
