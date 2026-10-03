"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Loader2 } from "lucide-react";

import {
  approveTransactionAction,
  rejectTransactionAction,
  type DecisionActionState,
} from "@/actions/approvals";
import { formatMinorUnits } from "@/lib/finance/money";

interface PendingRow {
  id: string;
  type: "PAYMENT" | "WITHDRAWAL";
  amountMinorUnits: string; // bigint as string (flight-safe)
  currency: string;
  paidTo: string | null;
  notes: string | null;
  createdAt: string;
  creatorName: string;
  creatorEmail: string;
}

export function ApprovalsQueue({
  projectSlug,
  rows,
  nextCursor,
}: {
  projectSlug: string;
  rows: PendingRow[];
  nextCursor: string | null;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<DecisionActionState | undefined, FormData>(
    async (prev, formData) => {
      const transactionId = String(formData.get("transactionId") ?? "");
      const intent = String(formData.get("intent") ?? "");
      let result: DecisionActionState;
      if (intent === "approve") {
        result = await approveTransactionAction(projectSlug, transactionId, prev, formData);
      } else if (intent === "reject") {
        result = await rejectTransactionAction(projectSlug, transactionId, prev, formData);
      } else {
        result = { ok: false, formError: "Unknown action." };
      }
      if (result.ok) router.refresh();
      return result;
    },
    undefined,
  );

  return (
    <div className="space-y-3" aria-busy={pending}>
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
        <div role="status" className="flex items-center gap-2 text-sm text-emerald-700">
          <Check className="h-4 w-4" aria-hidden="true" />
          Decision recorded.
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending transactions to review.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-start justify-between gap-4 rounded-lg border border-border p-4"
            >
              <div>
                <p className="text-sm font-medium text-foreground">
                  {row.type === "PAYMENT" ? "Payment" : "Withdrawal"} ·{" "}
                  <span className="font-mono">
                    {formatMinorUnits(BigInt(row.amountMinorUnits), row.currency)}
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  by {row.creatorName} ({row.creatorEmail})
                  {row.paidTo ? ` · paid to ${row.paidTo}` : ""}
                </p>
                {row.notes ? (
                  <p className="mt-1 text-xs text-muted-foreground">{row.notes}</p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground font-mono">
                  {new Date(row.createdAt).toLocaleString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <form action={formAction}>
                  <input type="hidden" name="transactionId" value={row.id} />
                  <input type="hidden" name="intent" value="approve" />
                  <button
                    type="submit"
                    disabled={pending}
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
                    Approve
                  </button>
                </form>
                <form action={formAction}>
                  <input type="hidden" name="transactionId" value={row.id} />
                  <input type="hidden" name="intent" value="reject" />
                  <button
                    type="submit"
                    disabled={pending}
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-[#E10600]/30 px-3 text-xs font-medium text-[#B30500] transition-colors hover:bg-[#E10600]/4.5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
                    Reject
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      {nextCursor ? (
        <a
          href={`/projects/${projectSlug}?reviewCursor=${encodeURIComponent(nextCursor)}`}
          className="inline-flex items-center text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          Load more pending reviews →
        </a>
      ) : null}
    </div>
  );
}
