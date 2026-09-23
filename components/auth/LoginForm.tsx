"use client";

import * as React from "react";
import Link from "next/link";
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

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5.25 w-5.25">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5.25 w-5.25 fill-[#0A0A0A]">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.38 7.86 10.9.58.1.79-.25.79-.56v-2.02c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.17 1.18.92-.26 1.9-.38 2.88-.39.98 0 1.96.13 2.88.39 2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.77.11 3.06.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.4-5.27 5.69.42.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.52 11.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
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

        <div>
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

          <div className="mt-3 flex justify-end">
            <Link
              href="/forgot-password"
              className="rounded-[6px] text-[14px] font-medium text-[#0A0A0A]/85 outline-none transition-colors duration-200 hover:text-[#E10600] focus-visible:ring-2 focus-visible:ring-[#E10600]/35"
            >
              Forgot password?
            </Link>
          </div>
        </div>
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

      <div className="my-7 flex items-center gap-4.5 text-[13px] font-normal text-black/45">
        <span className="h-px flex-1 bg-black/12" />
        <span>or continue with</span>
        <span className="h-px flex-1 bg-black/12" />
      </div>

      <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        <button
          type="button"
          className="flex h-11.5 items-center justify-center gap-2 rounded-[10px] border border-black/12 bg-white px-2 text-[13px] font-semibold text-[#0A0A0A] outline-none transition-colors duration-200 hover:border-black/22 hover:bg-[#F7F7F5] focus-visible:ring-2 focus-visible:ring-[#E10600]/35"
        >
          <GoogleIcon />
          Continue with Google
        </button>
        <button
          type="button"
          className="flex h-11.5 items-center justify-center gap-2 rounded-[10px] border border-black/12 bg-white px-2 text-[13px] font-semibold text-[#0A0A0A] outline-none transition-colors duration-200 hover:border-black/22 hover:bg-[#F7F7F5] focus-visible:ring-2 focus-visible:ring-[#E10600]/35"
        >
          <GitHubIcon />
          Continue with GitHub
        </button>
      </div>

      <p className="mt-7 text-center text-[14px] font-normal text-[#0A0A0A]/80">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-medium text-[#E10600] underline underline-offset-2 outline-none transition-colors duration-200 hover:text-[#C90500] focus-visible:ring-2 focus-visible:ring-[#E10600]/35"
        >
          Create one
        </Link>
      </p>
    </form>
  );
}
