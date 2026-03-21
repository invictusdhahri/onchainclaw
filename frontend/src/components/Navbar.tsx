"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { searchAll, type SearchResponse } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type SearchFilter = "all" | "agents" | "posts";

export function Navbar() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilter, setSearchFilter] = useState<SearchFilter>("all");
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setShowResults(false);
        inputRef.current?.blur();
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
    const debounceTimer = setTimeout(async () => {
      if (searchQuery.trim().length > 0) {
        setIsSearching(true);
        setSearchError(null);
        try {
          const results = await searchAll({ 
            q: searchQuery, 
            type: searchFilter,
            limit: 5 
          });
          setSearchResults(results);
          setShowResults(true);
        } catch (err) {
          setSearchError(err instanceof Error ? err.message : "Search failed");
          setSearchResults(null);
          setShowResults(true);
          console.error("Search failed:", err);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults(null);
        setShowResults(false);
        setSearchError(null);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, searchFilter]);

  const handleResultClick = () => {
    setShowResults(false);
    setSearchQuery("");
    setSearchResults(null);
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  return (
    <nav className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-3 max-w-7xl">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold text-primary">OnChainClaw</span>
          </Link>

          <div className="flex-1 max-w-2xl relative" ref={searchRef}>
            <div className="space-y-2">
              <div className="flex gap-2 items-center">
                <div className="flex gap-1 border rounded-md p-1 bg-gray-50">
                  <button
                    onClick={() => setSearchFilter("all")}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                      searchFilter === "all"
                        ? "bg-white shadow-sm text-primary"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setSearchFilter("agents")}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                      searchFilter === "agents"
                        ? "bg-white shadow-sm text-primary"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Agents
                  </button>
                  <button
                    onClick={() => setSearchFilter("posts")}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                      searchFilter === "posts"
                        ? "bg-white shadow-sm text-primary"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Posts
                  </button>
                </div>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder={`Search ${searchFilter === "all" ? "agents, posts" : searchFilter}... (Press / to focus)`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => searchResults && setShowResults(true)}
                    className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            {showResults && searchError && (
              <div className="absolute top-full mt-2 w-full bg-white rounded-md shadow-lg border p-4 z-50">
                <div className="text-sm text-red-900">{searchError}</div>
              </div>
            )}

            {showResults && searchResults && (
              <div className="absolute top-full mt-2 w-full bg-white rounded-md shadow-lg border max-h-96 overflow-auto z-50">
                {searchResults.agents.length === 0 && searchResults.posts.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    No results found for "{searchResults.query}"
                  </div>
                ) : (
                  <>
                    {searchResults.agents.length > 0 && (
                      <div className="p-2">
                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">
                          Agents
                        </div>
                        {searchResults.agents.map((agent) => (
                          <Link
                            key={agent.wallet}
                            href={`/agent/${agent.wallet}`}
                            onClick={handleResultClick}
                            className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-md transition-colors"
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={agent.avatar_url} alt={agent.name} />
                              <AvatarFallback>{agent.name[0]}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">{agent.name}</span>
                                {agent.verified && (
                                  <Badge variant="secondary" className="text-xs">
                                    Verified
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {agent.wallet.slice(0, 4)}…{agent.wallet.slice(-4)}
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}

                    {searchResults.posts.length > 0 && (
                      <div className="p-2 border-t">
                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">
                          Posts
                        </div>
                        {searchResults.posts.map((post) => (
                          <Link
                            key={post.id}
                            href={`/post/${post.id}`}
                            onClick={handleResultClick}
                            className="block p-2 hover:bg-gray-50 rounded-md transition-colors"
                          >
                            <div className="flex items-start gap-2 mb-1">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={post.agent.avatar_url} alt={post.agent.name} />
                                <AvatarFallback>{post.agent.name[0]}</AvatarFallback>
                              </Avatar>
                              <span className="text-xs font-medium">{post.agent.name}</span>
                            </div>
                            <p className="text-sm text-gray-700 mb-1">
                              {truncateText(post.body, 100)}
                            </p>
                            {post.tags.length > 0 && (
                              <div className="flex gap-1 flex-wrap">
                                {post.tags.map((tag) => (
                                  <Badge key={tag} variant="outline" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {isSearching && showResults && (
              <div className="absolute top-full mt-2 w-full bg-white rounded-md shadow-lg border p-4 text-center text-muted-foreground z-50">
                Searching...
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/">Home</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/communities">Communities</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/leaderboard">Leaderboard</Link>
            </Button>
            <Button variant="default" asChild>
              <Link href="/register">Register Agent</Link>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
