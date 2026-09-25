"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
} from "lucide-react";

import { authClient } from "@/lib/auth-client";
import {
  getSignInFieldErrors,
  type SignInFieldErrors,
} from "@/lib/validations/auth";

import { AuthField } from "./AuthField";

type LoginErrors = SignInFieldErrors & { form?: string };

interface AuthClientErrorShape {
  status?: number;
}

function toSignInErrorMessage(error: AuthClientErrorShape): string {
  switch (error?.status) {
    case 400:
    case 401:
      return "Invalid email or password.";
    case 403:
      return "You do not have permission to access the Ledger.";
    case 429:
      return "Too many attempts. Please wait a moment and try again.";
    default:
      return "Sign-in is unavailable right now. Please try again.";
  }
}

function getPostLoginRedirect(): string {
  if (typeof window === "undefined") return "/dashboard";

  const params = new URLSearchParams(window.location.search);
  const candidate = params.get("redirect") ?? params.get("callbackUrl");

  if (candidate && candidate.startsWith("/") && !candidate.startsWith("//")) {
    return candidate;
  }

  return "/dashboard";
}

export function LoginForm() {
  const router = useRouter();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [keepSignedIn, setKeepSignedIn] = React.useState(true);
  const [errors, setErrors] = React.useState<LoginErrors>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const emailRef = React.useRef<HTMLInputElement>(null);
  const passwordRef = React.useRef<HTMLInputElement>(null);

  function clearError(field: "email" | "password") {
    setErrors((prev) => {
      if (!prev[field] && !prev.form) return prev;
      const next = { ...prev };
      delete next[field];
      delete next.form;
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const fieldErrors = getSignInFieldErrors({ email, password });
    if (fieldErrors.email || fieldErrors.password) {
      setErrors(fieldErrors);
      const firstInvalid = fieldErrors.email ? emailRef : passwordRef;
      firstInvalid.current?.focus();
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const { error } = await authClient.signIn.email({
        email,
        password,
        rememberMe: keepSignedIn,
      });

      if (error) {
        setErrors({ form: toSignInErrorMessage(error) });
        setPassword("");
        setIsSubmitting(false);
        return;
      }

      router.replace(getPostLoginRedirect());
      router.refresh();
    } catch {
      setErrors({ form: "Sign-in is unavailable right now. Please try again." });
      setPassword("");
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-busy={isSubmitting}>
      <span aria-live="polite" className="sr-only">
        {isSubmitting ? "Signing you in..." : ""}
      </span>

      {errors.form ? (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2.5 rounded-[10px] border border-[#E10600]/20 bg-[#E10600]/4.5 px-3.5 py-3"
        >
          <AlertCircle
            className="mt-0.5 h-4 w-4 shrink-0 text-[#E10600]"
            aria-hidden="true"
          />
          <p className="text-[13px] font-medium leading-snug text-[#0A0A0A]">
            {errors.form}
          </p>
        </div>
      ) : null}

      <div className="space-y-4.25">
        <AuthField
          ref={emailRef}
          id="email"
          name="email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          placeholder="you@example.com"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            clearError("email");
          }}
          disabled={isSubmitting}
          error={errors.email}
          leadingIcon={<Mail className="h-4.75 w-4.75" strokeWidth={1.6} />}
        />

        <AuthField
          ref={passwordRef}
          id="password"
          name="password"
          label="Password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          placeholder="Enter your password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            clearError("password");
          }}
          disabled={isSubmitting}
          error={errors.password}
          leadingIcon={<Lock className="h-4.5 w-4.5" strokeWidth={1.6} />}
          trailingAction={
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              disabled={isSubmitting}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="flex h-9 w-9 items-center justify-center rounded-[9px] text-black/45 outline-none transition-colors duration-200 hover:bg-black/4 hover:text-black/80 focus-visible:ring-2 focus-visible:ring-[#E10600]/35 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {showPassword ? (
                <EyeOff className="h-4.5 w-4.5" strokeWidth={1.6} aria-hidden="true" />
              ) : (
                <Eye className="h-4.5 w-4.5" strokeWidth={1.6} aria-hidden="true" />
              )}
            </button>
          }
        />
      </div>

      <label className="mt-2.75 flex w-fit cursor-pointer items-center gap-2.75 text-[15px] font-medium text-[#0A0A0A]">
        <input
          type="checkbox"
          checked={keepSignedIn}
          onChange={(event) => setKeepSignedIn(event.target.checked)}
          disabled={isSubmitting}
          className="peer sr-only"
        />
        <span className="flex h-4.5 w-4.5 items-center justify-center rounded-lg border border-black/20 bg-white text-white transition-colors duration-200 peer-checked:border-[#E10600] peer-checked:bg-[#E10600] peer-focus-visible:ring-2 peer-focus-visible:ring-[#E10600]/35 peer-disabled:opacity-60">
          <Check className="h-3.25 w-3.25" strokeWidth={3} aria-hidden="true" />
        </span>
        Keep me signed in
      </label>

      <button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className="relative mt-6.25 flex h-h-12.75 w-full items-center justify-center rounded-[11px] bg-[#E10600] px-12 text-[17px] font-bold text-white outline-none transition-colors duration-200 hover:bg-[#C90500] focus-visible:ring-2 focus-visible:ring-[#E10600]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-80"
      >
        {isSubmitting ? (
          <span className="flex items-center gap-2.5">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Signing in...
          </span>
        ) : (
          <>
            <span>Sign In</span>
            <span className="absolute right-5.5 text-[27px] font-normal leading-none" aria-hidden="true">
              →
            </span>
          </>
        )}
      </button>
    </form>
  );
}
