"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Loader2 } from "lucide-react";

import { submitWithdrawalAction, type WithdrawalActionState } from "@/actions/withdrawals";

/**
 * Phase 6 withdrawal submission form.
 *
 * Same idempotency behavior as the payment form: a stable key per attempt,
 * kept across retries (double-click, network retry), rotated after success
 * or conflict. PENDING submissions have no financial impact until approved
 * in a later phase.
 */
export function WithdrawalForm({ projectSlug }: { projectSlug: string }) {
  const router = useRouter();
  const idempotencyKey = useRef<string>(crypto.randomUUID());
  const [formKey, setFormKey] = useState(0);

  const bound = submitWithdrawalAction.bind(null, projectSlug);
  const [state, formAction, pending] = useActionState<WithdrawalActionState | undefined, FormData>(
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
        {pending ? "Submitting withdrawal..." : ""}
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
              ? "This withdrawal was already submitted. No duplicate was created."
              : "Withdrawal submitted and pending approval."}
          </p>
        </div>
      ) : null}

      <div>
        <label htmlFor="withdrawal-amount" className="block text-sm font-medium text-foreground">
          Amount
        </label>
        <input
          id="withdrawal-amount"
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
        <label htmlFor="withdrawal-paid-to" className="block text-sm font-medium text-foreground">
          Paid to <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <input
          id="withdrawal-paid-to"
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
        <label htmlFor="withdrawal-notes" className="block text-sm font-medium text-foreground">
          Notes <span className="font-normal text-muted-foreground">(optional, max 255)</span>
        </label>
        <textarea
          id="withdrawal-notes"
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
        Submit withdrawal
      </button>
    </form>
  );
}
