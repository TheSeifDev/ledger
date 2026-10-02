"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Loader2 } from "lucide-react";

import { submitPaymentAction, type PaymentActionState } from "@/actions/payments";

/**
 * Phase 5 payment submission form.
 *
 * Idempotency: a stable key is generated per form attempt and kept across
 * retries (double-click, network retry, refresh-and-resubmit reuse the
 * stored transaction server-side). The key rotates after a success or a
 * conflict so a genuinely new payment never collides with the old one.
 */
export function PaymentForm({ projectSlug }: { projectSlug: string }) {
  const router = useRouter();
  const idempotencyKey = useRef<string>(crypto.randomUUID());
  const [formKey, setFormKey] = useState(0);

  const bound = submitPaymentAction.bind(null, projectSlug);
  const [state, formAction, pending] = useActionState<PaymentActionState | undefined, FormData>(
    async (prev, formData) => {
      formData.set("idempotencyKey", idempotencyKey.current);
      const result = await bound(prev, formData);
      if (result.ok) {
        idempotencyKey.current = crypto.randomUUID();
        setFormKey((k) => k + 1);
        router.refresh();
      }
      return result;
    },
    undefined,
  );

  return (
    <form key={formKey} action={formAction} className="space-y-4" aria-busy={pending}>
      <span aria-live="polite" className="sr-only">
        {pending ? "Submitting payment..." : ""}
      </span>

      {state?.formError ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-[10px] border border-[#E10600]/20 bg-[#E10600]/4.5 px-3.5 py-3"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#E10600]" aria-hidden="true" />
          <p className="text-[13px] font-medium leading-snug text-[#0A0A0A]">{state.formError}</p>
        </div>
      ) : null}

      {state?.ok ? (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-[10px] border border-emerald-200 bg-emerald-50 px-3.5 py-3"
        >
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
          <p className="text-[13px] font-medium text-emerald-800">
            {state.replayed
              ? "This payment was already submitted. No duplicate was created."
              : "Payment submitted and pending approval."}
          </p>
        </div>
      ) : null}

      <div>
        <label htmlFor="payment-amount" className="block text-sm font-medium text-foreground">
          Amount
        </label>
        <input
          id="payment-amount"
          name="amount"
          type="text"
          inputMode="decimal"
          required
          placeholder="0.00"
          disabled={pending}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
        />
        {state?.fieldErrors?.amount ? (
          <p role="alert" className="mt-1 text-xs text-[#B30500]">{state.fieldErrors.amount}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="payment-paid-to" className="block text-sm font-medium text-foreground">
          Paid to <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <input
          id="payment-paid-to"
          name="paidTo"
          type="text"
          placeholder="Recipient"
          disabled={pending}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        {state?.fieldErrors?.paidTo ? (
          <p role="alert" className="mt-1 text-xs text-[#B30500]">{state.fieldErrors.paidTo}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="payment-notes" className="block text-sm font-medium text-foreground">
          Notes <span className="font-normal text-muted-foreground">(optional, max 255)</span>
        </label>
        <textarea
          id="payment-notes"
          name="notes"
          rows={3}
          maxLength={255}
          disabled={pending}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        {state?.fieldErrors?.notes ? (
          <p role="alert" className="mt-1 text-xs text-[#B30500]">{state.fieldErrors.notes}</p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-foreground px-5 text-sm font-medium text-background transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Submit payment
      </button>
    </form>
  );
}
