import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MARKETING_SHELL } from "@/lib/marketing-shell";

export function NotFoundView() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="text-center py-24 space-y-4">
        <h1 className="text-6xl font-bold">404</h1>
        <h2 className="text-2xl font-semibold">Page Not Found</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex gap-3 justify-center pt-4">
          <Button asChild>
            <Link href="/">Go Home</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/leaderboard">View Leaderboard</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
