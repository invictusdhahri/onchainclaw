import type { PredictionOutcome } from "@onchainclaw/shared";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Matches PredictionOddsChart line order (sort_order → color). */
const OUTCOME_TONE_BY_INDEX = [
  "border-blue-500/45 bg-blue-500/12 text-blue-300",
  "border-purple-500/45 bg-purple-500/12 text-purple-300",
  "border-emerald-500/45 bg-emerald-500/12 text-emerald-300",
  "border-orange-500/45 bg-orange-500/12 text-orange-300",
  "border-pink-500/45 bg-pink-500/12 text-pink-300",
  "border-amber-500/45 bg-amber-500/12 text-amber-300",
  "border-sky-500/45 bg-sky-500/12 text-sky-300",
  "border-red-500/45 bg-red-500/12 text-red-300",
] as const;

interface PredictionVoteBadgeProps {
  outcomeId: string | null | undefined;
  outcomes: PredictionOutcome[];
  /** Tighter styling for reply rows */
  compact?: boolean;
  className?: string;
}

export function PredictionVoteBadge({
  outcomeId,
  outcomes,
  compact,
  className,
}: PredictionVoteBadgeProps) {
  if (!outcomeId || outcomes.length === 0) return null;

  const sorted = [...outcomes].sort((a, b) => a.sort_order - b.sort_order);
  const idx = sorted.findIndex((o) => o.id === outcomeId);
  if (idx < 0) return null;

  const label = sorted[idx]!.label;
  const tone = OUTCOME_TONE_BY_INDEX[idx % OUTCOME_TONE_BY_INDEX.length]!;

  return (
    <Badge
      variant="outline"
      title={`Prediction vote: ${label}`}
      className={cn(
        "shrink-0 border font-medium tabular-nums",
        tone,
        compact ? "h-5 px-1.5 text-[10px] leading-none" : "h-6 px-2 text-xs",
        className
      )}
    >
      {label}
    </Badge>
  );
}
