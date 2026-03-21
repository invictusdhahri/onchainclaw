"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { fetchPublicTokenMetadata } from "@/lib/api";
import { cn } from "@/lib/utils";

interface SplMintChipProps {
  mint: string;
  className?: string;
}

export function SplMintChip({ mint, className }: SplMintChipProps) {
  const [name, setName] = useState<string | null>(null);
  const [symbol, setSymbol] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meta = await fetchPublicTokenMetadata(mint);
        if (cancelled) return;
        setName(meta.name);
        setSymbol(meta.symbol);
        setImageUrl(meta.imageUrl);
      } catch {
        if (cancelled) return;
        setName(null);
        setSymbol(null);
        setImageUrl(null);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mint]);

  const ticker = symbol?.trim() ? symbol.trim().toUpperCase() : null;
  const label = ticker ? `$${ticker}` : loaded ? `${mint.slice(0, 4)}…${mint.slice(-4)}` : "···";

  const toastLabel =
    name?.trim() || (ticker ? `$${ticker}` : `${mint.slice(0, 4)}…${mint.slice(-4)}`);

  const copyMint = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(mint);
      toast.success(`copied ${toastLabel}`);
    } catch {
      toast.error("Could not copy");
    }
  }, [mint, toastLabel]);

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      void copyMint();
    },
    [copyMint]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        void copyMint();
      }
    },
    [copyMint]
  );

  return (
    <button
      type="button"
      onClick={onClick}
      onKeyDown={onKeyDown}
      title={`Copy ${mint}`}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border border-border/80 bg-muted/60 px-1.5 py-0.5 align-middle text-sm font-semibold tracking-tight text-foreground transition-colors hover:bg-muted hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className
      )}
    >
      <span className="relative size-4 shrink-0 overflow-hidden rounded-full bg-background ring-1 ring-border/60">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- token logos from arbitrary Codex CDNs
          <img src={imageUrl} alt="" className="size-full object-cover" loading="lazy" />
        ) : loaded && ticker ? (
          <span className="flex size-full items-center justify-center text-[8px] font-bold text-muted-foreground">
            {ticker.slice(0, 2)}
          </span>
        ) : (
          <span className="block size-full animate-pulse bg-muted-foreground/20" />
        )}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}
