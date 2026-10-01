"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Loader2 } from "lucide-react";

import { updateProjectAction, type ProjectActionState } from "@/actions/projects";

export function ProjectEditForm({
  project,
}: {
  project: {
    slug: string;
    name: string;
    description: string | null;
    budget: string;
    currency: string;
    status: "ACTIVE" | "ARCHIVED";
  };
}) {
  const router = useRouter();
  const bound = updateProjectAction.bind(null, project.slug);
  const [state, formAction, pending] = useActionState<ProjectActionState | undefined, FormData>(
    async (prev, formData) => {
      const result = await bound(prev, formData);
      if (result?.ok) {
        router.refresh();
        router.push(`/projects/${result.slug}/settings`);
      }
      return result;
    },
    undefined,
  );

  // Render the current budget in major units for editing.
  const budgetMajor = project.budget;

  return (
    <form action={formAction} className="space-y-4" aria-busy={pending}>
      <span aria-live="polite" className="sr-only">
        {pending ? "Saving project..." : ""}
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
          className="flex items-center gap-2 rounded-[10px] border border-emerald-200 bg-emerald-50 px-3.5 py-3"
        >
          <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          <p className="text-[13px] font-medium text-emerald-800">Changes saved.</p>
        </div>
      ) : null}

      <div>
        <label htmlFor="edit-name" className="block text-sm font-medium text-foreground">
          Name
        </label>
        <input
          id="edit-name"
          name="name"
          type="text"
          required
          defaultValue={project.name}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        {state?.fieldErrors?.name ? (
          <p role="alert" className="mt-1 text-xs text-[#B30500]">{state.fieldErrors.name}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="edit-slug" className="block text-sm font-medium text-foreground">
          Slug
        </label>
        <input
          id="edit-slug"
          name="slug"
          type="text"
          required
          defaultValue={project.slug}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
        />
        {state?.fieldErrors?.slug ? (
          <p role="alert" className="mt-1 text-xs text-[#B30500]">{state.fieldErrors.slug}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="edit-description" className="block text-sm font-medium text-foreground">
          Description
        </label>
        <textarea
          id="edit-description"
          name="description"
          rows={3}
          defaultValue={project.description ?? ""}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="edit-budget" className="block text-sm font-medium text-foreground">
            Budget
          </label>
          <input
            id="edit-budget"
            name="budget"
            type="text"
            inputMode="decimal"
            required
            defaultValue={budgetMajor}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
          />
          {state?.fieldErrors?.budget ? (
            <p role="alert" className="mt-1 text-xs text-[#B30500]">{state.fieldErrors.budget}</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="edit-currency" className="block text-sm font-medium text-foreground">
            Currency
          </label>
          <input
            id="edit-currency"
            name="currency"
            type="text"
            maxLength={3}
            required
            defaultValue={project.currency}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono uppercase"
          />
          {state?.fieldErrors?.currency ? (
            <p role="alert" className="mt-1 text-xs text-[#B30500]">{state.fieldErrors.currency}</p>
          ) : null}
        </div>
      </div>

      <div>
        <label htmlFor="edit-status" className="block text-sm font-medium text-foreground">
          Status
        </label>
        <select
          id="edit-status"
          name="status"
          defaultValue={project.status}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="ACTIVE">Active</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        {state?.fieldErrors?.status ? (
          <p role="alert" className="mt-1 text-xs text-[#B30500]">{state.fieldErrors.status}</p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-foreground px-5 text-sm font-medium text-background transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Save changes
      </button>
    </form>
  );
}
