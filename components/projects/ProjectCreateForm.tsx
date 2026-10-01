"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";

import { createProjectAction, type ProjectActionState } from "@/actions/projects";

export function ProjectCreateForm({
  organizations,
}: {
  organizations: { organizationId: string; name: string }[];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ProjectActionState | undefined, FormData>(
    async (prev, formData) => {
      const result = await createProjectAction(prev, formData);
      if (result?.ok) {
        router.refresh();
      }
      return result;
    },
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4" aria-busy={pending}>
      <span aria-live="polite" className="sr-only">
        {pending ? "Creating project..." : ""}
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

      {organizations.length > 1 && (
        <div>
          <label htmlFor="create-org" className="block text-sm font-medium text-foreground">
            Organization
          </label>
          <select
            id="create-org"
            name="organizationId"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {organizations.map((org) => (
              <option key={org.organizationId} value={org.organizationId}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {organizations.length === 1 && (
        <input type="hidden" name="organizationId" value={organizations[0].organizationId} />
      )}

      <div>
        <label htmlFor="create-name" className="block text-sm font-medium text-foreground">
          Name
        </label>
        <input
          id="create-name"
          name="name"
          type="text"
          required
          placeholder="Project name"
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        {state?.fieldErrors?.name ? (
          <p role="alert" className="mt-1 text-xs text-[#B30500]">{state.fieldErrors.name}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="create-slug" className="block text-sm font-medium text-foreground">
          Slug
        </label>
        <input
          id="create-slug"
          name="slug"
          type="text"
          required
          placeholder="project-slug"
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
        />
        {state?.fieldErrors?.slug ? (
          <p role="alert" className="mt-1 text-xs text-[#B30500]">{state.fieldErrors.slug}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="create-description" className="block text-sm font-medium text-foreground">
          Description
        </label>
        <textarea
          id="create-description"
          name="description"
          rows={3}
          placeholder="What is this project about?"
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="create-budget" className="block text-sm font-medium text-foreground">
            Budget
          </label>
          <input
            id="create-budget"
            name="budget"
            type="text"
            inputMode="decimal"
            required
            placeholder="0.00"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
          />
          {state?.fieldErrors?.budget ? (
            <p role="alert" className="mt-1 text-xs text-[#B30500]">{state.fieldErrors.budget}</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="create-currency" className="block text-sm font-medium text-foreground">
            Currency
          </label>
          <input
            id="create-currency"
            name="currency"
            type="text"
            maxLength={3}
            required
            defaultValue="EGP"
            placeholder="EGP"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono uppercase"
          />
          {state?.fieldErrors?.currency ? (
            <p role="alert" className="mt-1 text-xs text-[#B30500]">{state.fieldErrors.currency}</p>
          ) : null}
        </div>
      </div>

      <div>
        <label htmlFor="create-status" className="block text-sm font-medium text-foreground">
          Status
        </label>
        <select
          id="create-status"
          name="status"
          defaultValue="ACTIVE"
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
        Create project
      </button>
    </form>
  );
}
