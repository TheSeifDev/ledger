import type * as React from "react";

import { cn } from "@/lib/utils";

interface EditorialLabelProps {
  children: React.ReactNode;
  className?: string;
  accent?: "horizontal" | "vertical";
}

export function EditorialLabel({
  children,
  className,
  accent = "horizontal",
}: EditorialLabelProps) {
  return (
    <div
      className={cn(
        "pointer-events-none flex items-start gap-3 text-[12px] font-bold uppercase leading-[1.55] tracking-[0.34em] text-[#0A0A0A]",
        className
      )}
      aria-hidden="true"
    >
      <span
        className={cn(
          "mt-1.5 shrink-0 bg-[#E10600]",
          accent === "vertical" ? "h-9.5 w-0.5" : "h-0.5 w-6"
        )}
      />
      <span>{children}</span>
    </div>
  );
}
