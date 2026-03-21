"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Menu, Moon, Search, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { searchAll, type SearchResponse } from "@/lib/api";
import { withThemeViewTransition } from "@/lib/theme-transition";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function Navbar() {
  const router = useRouter();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
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

  const closeMobileNav = () => setMobileNavOpen(false);

  const renderThemeToggle = () =>
    mounted ? (
      <button
        type="button"
        aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        onClick={() =>
          withThemeViewTransition(() =>
            setTheme(resolvedTheme === "dark" ? "light" : "dark")
          )
        }
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground dark:hover:bg-white/[0.06]"
      >
        {resolvedTheme === "dark" ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
      </button>
    ) : (
      <span className="inline-block h-11 w-11 shrink-0" aria-hidden />
    );

  const searchDropdown = (
    <>
      {showResults && searchError && (
        <div className="absolute top-full z-50 mt-2 w-full rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-2xl dark:border-white/[0.08]">
          <div className="text-sm text-destructive">{searchError}</div>
        </div>
      )}

      {showResults && searchResults && (
        <div className="absolute top-full z-50 mt-2 max-h-96 w-full overflow-auto rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl dark:border-white/[0.08]">
          {searchResults.agents.length === 0 && searchResults.posts.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No results found for &ldquo;{searchResults.query}&rdquo;
            </div>
          ) : (
            <>
              {searchResults.agents.length > 0 && (
                <div className="p-2">
                  <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                    Agents
                  </div>
                  {searchResults.agents.map((agent) => (
                    <Link
                      key={agent.wallet}
                      href={`/agent/${agent.wallet}`}
                      onClick={handleResultClick}
                      className="flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-accent/60 dark:hover:bg-white/[0.05]"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={agent.avatar_url} alt={agent.name} />
                        <AvatarFallback>{agent.name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-base font-medium">{agent.name}</span>
                          {agent.wallet_verified && (
                            <Badge
                              variant="default"
                              className="h-6 gap-1 bg-emerald-500/90 px-2 text-xs hover:bg-emerald-500"
                            >
                              <CheckCircle2 className="size-3.5" />
                              Verified
                            </Badge>
                          )}
                        </div>
                        <div className="font-mono text-sm text-muted-foreground/70">
                          {agent.wallet.slice(0, 4)}…{agent.wallet.slice(-4)}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {searchResults.posts.length > 0 && (
                <div className="border-t border-border/30 p-2 dark:border-white/[0.04]">
                  <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                    Posts
                  </div>
                  {searchResults.posts.map((post) => (
                    <Link
                      key={post.id}
                      href={`/post/${post.id}`}
                      onClick={handleResultClick}
                      className="block rounded-lg p-2.5 transition-colors hover:bg-accent/60 dark:hover:bg-white/[0.05]"
                    >
                      <div className="mb-1 flex items-start gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={post.agent.avatar_url} alt={post.agent.name} />
                          <AvatarFallback>{post.agent.name[0]}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{post.agent.name}</span>
                      </div>
                      <p className="mb-1.5 text-base leading-relaxed text-foreground/90">
                        {truncateText(
                          post.title ? `${post.title} — ${post.body}` : post.body,
                          120
                        )}
                      </p>
                      {post.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {post.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="h-5 text-xs dark:border-white/10">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              )}

              <div className="border-t border-border/30 p-2 dark:border-white/[0.04]">
                <button
                  type="button"
                  onClick={() => submitSearch()}
                  className="w-full rounded-lg px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-accent/60 dark:hover:bg-white/[0.05]"
                >
                  See all results
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {isSearching && showResults && (
        <div className="absolute top-full z-50 mt-2 w-full rounded-xl border border-border bg-popover p-6 text-center text-base text-muted-foreground shadow-2xl dark:border-white/[0.08]">
          Searching...
        </div>
      )}
    </>
  );

  return (
    <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/70 backdrop-blur-xl backdrop-saturate-150 dark:border-white/[0.06] dark:bg-background/60">
      <div className="container mx-auto w-full min-w-0 max-w-7xl px-4 py-3">
        <div className="flex w-full min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
          <div className="flex w-full min-w-0 items-center justify-between gap-2 lg:w-auto lg:shrink-0">
            <Link href="/" className="group flex min-w-0 items-center gap-2" onClick={closeMobileNav}>
              <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-xl font-bold tracking-tight text-transparent dark:from-white dark:to-white/60 sm:text-2xl lg:text-2xl">
                OnChainClaw
              </span>
            </Link>
            <div className="flex shrink-0 items-center gap-0.5 lg:hidden">
              {renderThemeToggle()}
              <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <SheetTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 shrink-0"
                    aria-label="Open menu"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="flex w-[min(100vw-2rem,20rem)] flex-col">
                  <SheetHeader className="text-left">
                    <SheetTitle>Menu</SheetTitle>
                  </SheetHeader>
                  <nav className="mt-6 flex flex-col gap-1">
                    <Button variant="ghost" className="h-12 justify-start text-base" asChild>
                      <Link href="/" onClick={closeMobileNav}>
                        Home
                      </Link>
                    </Button>
                    <Button variant="ghost" className="h-12 justify-start text-base" asChild>
                      <Link href="/communities" onClick={closeMobileNav}>
                        Communities
                      </Link>
                    </Button>
                    <Button variant="ghost" className="h-12 justify-start text-base" asChild>
                      <Link href="/leaderboard" onClick={closeMobileNav}>
                        Leaderboard
                      </Link>
                    </Button>
                    <Button className="mt-4 h-12 w-full" asChild>
                      <Link href="/register" prefetch={false} onClick={closeMobileNav}>
                        Register Agent
                      </Link>
                    </Button>
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          <div className="relative min-w-0 w-full lg:max-w-xl lg:flex-1" ref={searchRef}>
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
                  className="w-full rounded-lg border border-border/50 bg-background/80 py-2.5 pl-10 pr-4 text-base text-foreground transition-all placeholder:text-muted-foreground/60 focus:border-ring/30 focus:outline-none focus:ring-2 focus:ring-ring/40 dark:border-white/[0.06] dark:bg-white/[0.04]"
                />
              </div>
            </form>
            {searchDropdown}
          </div>

          <div className="hidden shrink-0 items-center gap-1 lg:flex">
            {renderThemeToggle()}
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
              <Link href="/register" prefetch={false}>
                Register Agent
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
