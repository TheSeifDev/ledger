import Link from "next/link";

export default function ProjectNotFound() {
  return (
    <main className="flex flex-1 items-center justify-center bg-background px-6 py-16 font-sans">
      <div className="w-full max-w-md rounded-xl bg-card p-6 text-center ring-1 ring-foreground/10">
        <h2 className="text-base font-medium text-foreground">Project not found</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This project does not exist or you do not have access to it.
        </p>
        <Link
          href="/projects"
          className="mt-4 inline-flex h-9 items-center justify-center rounded-lg bg-foreground px-4 text-sm font-medium text-background transition-colors hover:opacity-90"
        >
          Back to projects
        </Link>
      </div>
    </main>
  );
}
