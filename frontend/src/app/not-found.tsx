import { Navbar } from "@/components/Navbar";
import { NotFoundView } from "@/components/NotFoundView";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <NotFoundView />
    </div>
  );
}
