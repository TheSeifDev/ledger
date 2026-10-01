"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireAuthenticatedUser, AuthorizationError } from "@/server/guards/auth";
import {
  createProjectSchema,
  updateProjectSchema,
  getProjectFieldErrors,
  type ProjectFieldErrors,
} from "@/lib/validations/project";
import * as projectService from "@/server/services/projects";
import { ProjectConflictError } from "@/server/services/projects";

export type ProjectActionState = {
  ok: boolean;
  fieldErrors?: ProjectFieldErrors;
  formError?: string;
  slug?: string;
};

function formValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function toFailure(error: unknown): ProjectActionState {
  if (error instanceof AuthorizationError) {
    return {
      ok: false,
      formError:
        error.code === "PROJECT_NOT_FOUND"
          ? "Project not found."
          : "You do not have permission to perform this action.",
    };
  }
  if (error instanceof ProjectConflictError) {
    return {
      ok: false,
      fieldErrors: error.code === "DUPLICATE_SLUG" ? { slug: error.message } : {},
      formError: error.code === "DUPLICATE_SLUG" ? undefined : error.message,
    };
  }
  return {
    ok: false,
    formError: "Something went wrong. Please try again.",
  };
}

export async function createProjectAction(
  _prev: ProjectActionState | undefined,
  formData: FormData,
): Promise<ProjectActionState> {
  const { user } = await requireAuthenticatedUser();

  const input = {
    organizationId: formValue(formData, "organizationId"),
    name: formValue(formData, "name"),
    slug: formValue(formData, "slug"),
    description: formValue(formData, "description") || undefined,
    budget: formValue(formData, "budget"),
    currency: formValue(formData, "currency"),
    status: formValue(formData, "status") || "ACTIVE",
  };

  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: getProjectFieldErrors(parsed.error) };
  }

  let createdSlug: string;
  try {
    const created = await projectService.createProject(user.id, parsed.data);
    createdSlug = created.slug;
  } catch (error) {
    return toFailure(error);
  }

  revalidatePath("/projects");
  redirect(`/projects/${createdSlug}`);
}

export async function updateProjectAction(
  slug: string,
  _prev: ProjectActionState | undefined,
  formData: FormData,
): Promise<ProjectActionState> {
  const { user } = await requireAuthenticatedUser();

  const input = {
    name: formValue(formData, "name"),
    slug: formValue(formData, "slug"),
    description: formValue(formData, "description") || undefined,
    budget: formValue(formData, "budget"),
    currency: formValue(formData, "currency"),
    status: formValue(formData, "status"),
  };

  const parsed = updateProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: getProjectFieldErrors(parsed.error) };
  }

  let nextSlug: string;
  try {
    const updated = await projectService.updateProject(user.id, slug, parsed.data);
    nextSlug = updated.slug;
  } catch (error) {
    return toFailure(error);
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${slug}`);
  revalidatePath(`/projects/${slug}/settings`);
  if (nextSlug !== slug) {
    revalidatePath(`/projects/${nextSlug}`);
    redirect(`/projects/${nextSlug}/settings`);
  }
  return { ok: true, slug: nextSlug };
}

export async function addProjectMemberAction(
  slug: string,
  _prev: ProjectActionState | undefined,
  formData: FormData,
): Promise<ProjectActionState> {
  const { user } = await requireAuthenticatedUser();
  const userId = formValue(formData, "userId");

  if (!userId) {
    return { ok: false, fieldErrors: { userId: "User is required." } };
  }

  try {
    await projectService.addProjectMember(user.id, slug, userId);
    revalidatePath(`/projects/${slug}/settings`);
    return { ok: true };
  } catch (error) {
    return toFailure(error);
  }
}

export async function removeProjectMemberAction(
  slug: string,
  _prev: ProjectActionState | undefined,
  formData: FormData,
): Promise<ProjectActionState> {
  const { user } = await requireAuthenticatedUser();
  const userId = formValue(formData, "userId");

  if (!userId) {
    return { ok: false, fieldErrors: { userId: "User is required." } };
  }

  try {
    await projectService.removeProjectMember(user.id, slug, userId);
    revalidatePath(`/projects/${slug}/settings`);
    return { ok: true };
  } catch (error) {
    return toFailure(error);
  }
}
