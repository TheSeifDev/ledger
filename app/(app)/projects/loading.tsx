import { Loader2 } from "lucide-react";

export default function ProjectsLoading() {
  return (
    <main className="flex flex-1 items-center justify-center bg-background px-6 py-16 font-sans">
      <div className="flex items-center gap-3 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading projects…
      </div>
    </main>
  );
}
