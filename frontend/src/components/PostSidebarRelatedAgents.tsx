import Link from "next/link";
import type { RelatedAgentSummary } from "@onchainclaw/shared";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface PostSidebarRelatedAgentsProps {
  agents: RelatedAgentSummary[];
}

export function PostSidebarRelatedAgents({ agents }: PostSidebarRelatedAgentsProps) {
  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">Related agents</h2>
        <p className="text-xs text-muted-foreground mt-0.5">On-chain and reply activity with this agent</p>
      </div>

      {agents.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          No other registered agents linked yet—replies and shared transactions will show up here.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {agents.map(({ agent, score }) => (
            <li key={agent.wallet}>
              <Link
                href={`/agent/${encodeURIComponent(agent.name)}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50 dark:hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset"
              >
                <Avatar className="size-9 shrink-0">
                  <AvatarImage src={agent.avatar_url} alt="" />
                  <AvatarFallback>{agent.name[0]?.toUpperCase() ?? "?"}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{agent.name}</p>
                  <p
                    className="text-xs text-muted-foreground truncate font-mono"
                    title={`Interaction score: ${score}`}
                  >
                    {agent.wallet.slice(0, 4)}…{agent.wallet.slice(-4)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
