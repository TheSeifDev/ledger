import * as React from "react";

import { cn } from "@/lib/utils";

export interface AuthFieldProps
  extends Omit<React.ComponentPropsWithoutRef<"input">, "id"> {
  id: string;
  label: string;
  error?: string;
  leadingIcon?: React.ReactNode;
  trailingAction?: React.ReactNode;
}

export const AuthField = React.forwardRef<HTMLInputElement, AuthFieldProps>(
  function AuthField(
    { id, label, error, leadingIcon, trailingAction, className, ...inputProps },
    ref
  ) {
    const errorId = `${id}-error`;

    return (
      <div className="w-full">
        <label
          htmlFor={id}
          className="mb-2 block text-[15px] font-bold leading-none text-[#0A0A0A]"
        >
          {label}
        </label>

        <div className="group relative">
          {leadingIcon ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-black/35 transition-colors duration-200 group-focus-within:text-black/70"
            >
              {leadingIcon}
            </span>
          ) : null}

          <input
            ref={ref}
            id={id}
            className={cn(
              "auth-input h-11.5 w-full rounded-[11px] border bg-white px-3.5 text-[15px] text-[#0A0A0A] outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-black/38",
              "focus:border-[#E10600] focus:ring-[3px] focus:ring-[#E10600]/15",
              "disabled:cursor-not-allowed disabled:opacity-60",
              error ? "border-[#E10600]" : "border-black/15 hover:border-black/24",
              leadingIcon ? "pl-10.75" : null,
              trailingAction ? "pr-12" : null,
              className
            )}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            {...inputProps}
          />

          {trailingAction ? (
            <span className="absolute right-1.5 top-1/2 -translate-y-1/2">
              {trailingAction}
            </span>
          ) : null}
        </div>

        {error ? (
          <p
            id={errorId}
            role="alert"
            className="mt-2 text-[12.5px] font-medium leading-snug text-[#E10600]"
          >
            {error}
          </p>
        ) : null}
      </div>
    );
  }
);
