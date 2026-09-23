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
        "auth-rise w-full rounded-[20px] border border-black/[0.08] bg-white/[0.94] px-[42px] py-[45px] shadow-[0_28px_70px_-48px_rgba(10,10,10,0.55)] backdrop-blur-[1px]",
        "min-h-[670px] max-sm:min-h-0 max-sm:px-6 max-sm:py-8",
        className
      )}
      aria-labelledby="login-heading"
    >
      <p className="text-[12px] font-semibold uppercase tracking-[0.52em] text-black/55">
        WELCOME BACK
      </p>

      <h2
        id="login-heading"
        className="mt-[17px] text-[31px] font-extrabold leading-[1.05] tracking-[-0.035em] text-[#0A0A0A] max-sm:text-[28px]"
      >
        Sign in to your workspace
      </h2>

      <p className="mt-[9px] max-w-[435px] text-[15px] font-normal leading-[1.42] text-black/62">
        Continue building. Manage your projects, track your finances, and keep your team in sync.
      </p>

      <div className="mt-[34px]">{children}</div>
    </section>
  );
}
