"use client";

import { AlertCircle } from "lucide-react";

export default function ProjectError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex flex-1 items-center justify-center bg-background px-6 py-16 font-sans">
      <div className="w-full max-w-md rounded-xl bg-card p-6 ring-1 ring-foreground/10" role="alert">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#E10600]" aria-hidden="true" />
          <div>
            <h2 className="text-base font-medium text-foreground">Something went wrong</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The project could not be loaded. Please try again.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          className="mt-4 inline-flex h-9 items-center justify-center rounded-lg bg-foreground px-4 text-sm font-medium text-background transition-colors hover:opacity-90"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
