import type * as React from "react";

import { cn } from "@/lib/utils";

export interface LoginCardProps {
  children: React.ReactNode;
  className?: string;
}

export function LoginCard({ children, className }: LoginCardProps) {
  return (
    <section
      className={cn(
        "auth-rise w-full rounded-[20px] border border-black/8 bg-white/94 px-10.5 py-11.25 shadow-[0_28px_70px_-48px_rgba(10,10,10,0.55)] backdrop-blur-[1px]",
        "min-h-167.5 max-sm:min-h-0 max-sm:px-6 max-sm:py-8",
        className
      )}
      aria-labelledby="login-heading"
    >
      <p className="text-[12px] font-semibold uppercase tracking-[0.52em] text-black/55">
        WELCOME BACK
      </p>

      <h2
        id="login-heading"
        className="mt-4.25 text-[31px] font-extrabold leading-[1.05] tracking-[-0.035em] text-[#0A0A0A] max-sm:text-[28px]"
      >
        Sign in to your workspace
      </h2>

      <p className="mt-2.25 max-w-108.75 text-[15px] font-normal leading-[1.42] text-black/62">
        Continue building. Manage your projects, track your finances, and keep your team in sync.
      </p>

      <div className="mt-8.5">{children}</div>
    </section>
  );
}
