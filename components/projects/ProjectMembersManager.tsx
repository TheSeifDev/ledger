"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, UserMinus, UserPlus } from "lucide-react";

import {
  addProjectMemberAction,
  removeProjectMemberAction,
  type ProjectActionState,
} from "@/actions/projects";

type Member = {
  userId: string;
  name: string;
  email: string;
};

export function ProjectMembersManager({
  slug,
  members,
  eligible,
  canManage,
}: {
  slug: string;
  members: Member[];
  eligible: Member[];
  canManage: boolean;
}) {
  const router = useRouter();

  const [addState, addAction, addPending] = useActionState<
    ProjectActionState | undefined,
    FormData
  >(
    async (prev, formData) => {
      const bound = addProjectMemberAction.bind(null, slug);
      const result = await bound(prev, formData);
      if (result?.ok) router.refresh();
      return result;
    },
    undefined,
  );

  const [removeState, removeAction, removePending] = useActionState<
    ProjectActionState | undefined,
    FormData
  >(
    async (prev, formData) => {
      const bound = removeProjectMemberAction.bind(null, slug);
      const result = await bound(prev, formData);
      if (result?.ok) router.refresh();
      return result;
    },
    undefined,
  );

  const error =
    addState?.formError ?? removeState?.formError;

  return (
    <div className="space-y-4">
      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-[10px] border border-[#E10600]/20 bg-[#E10600]/4.5 px-3.5 py-3"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#E10600]" aria-hidden="true" />
          <p className="text-[13px] font-medium leading-snug text-[#0A0A0A]">{error}</p>
        </div>
      ) : null}

      <ul className="divide-y divide-border rounded-lg border border-border">
        {members.length === 0 ? (
          <li className="px-4 py-3 text-sm text-muted-foreground">
            No members yet.
          </li>
        ) : (
          members.map((member) => (
            <li key={member.userId} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">{member.name}</p>
                <p className="text-xs text-muted-foreground">{member.email}</p>
              </div>
              {canManage ? (
                <form action={removeAction}>
                  <input type="hidden" name="userId" value={member.userId} />
                  <button
                    type="submit"
                    disabled={removePending}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={`Remove ${member.name} from the project`}
                  >
                    {removePending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <UserMinus className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    Remove
                  </button>
                </form>
              ) : null}
            </li>
          ))
        )}
      </ul>

      {canManage ? (
        <form action={addAction} className="flex items-end gap-3">
          <div className="flex-1">
            <label htmlFor="add-member" className="block text-sm font-medium text-foreground">
              Add member
            </label>
            <select
              id="add-member"
              name="userId"
              required
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              disabled={eligible.length === 0 || addPending}
            >
              <option value="">
                {eligible.length === 0
                  ? "No organization members available"
                  : "Select an organization member…"}
              </option>
              {eligible.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.name} ({member.email})
                </option>
              ))}
            </select>
            {addState?.fieldErrors?.userId ? (
              <p role="alert" className="mt-1 text-xs text-[#B30500]">
                {addState.fieldErrors.userId}
              </p>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={eligible.length === 0 || addPending}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-foreground px-4 text-sm font-medium text-background transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {addPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <UserPlus className="h-4 w-4" aria-hidden="true" />
            )}
            Add
          </button>
        </form>
      ) : null}
    </div>
  );
}
