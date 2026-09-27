import "server-only";

import { db } from "@/db";
import { eq, and } from "drizzle-orm";
import { organization, organizationMember, project, projectMember } from "@/db/schema";

export async function findOrganizationById(id: string) {
  return db.query.organization.findFirst({
    where: eq(organization.id, id),
  });
}

export async function findOrganizationBySlug(slug: string) {
  return db.query.organization.findFirst({
    where: eq(organization.slug, slug),
  });
}

export async function findOrganizationMembership(userId: string, organizationId: string) {
  return db.query.organizationMember.findFirst({
    where: and(
      eq(organizationMember.userId, userId),
      eq(organizationMember.organizationId, organizationId),
    ),
  });
}

export async function findOrganizationMembershipsForUser(userId: string) {
  return db.query.organizationMember.findMany({
    where: eq(organizationMember.userId, userId),
  });
}

export async function findProjectById(id: string) {
  return db.query.project.findFirst({
    where: eq(project.id, id),
  });
}

export async function findProjectBySlug(organizationId: string, slug: string) {
  return db.query.project.findFirst({
    where: and(
      eq(project.organizationId, organizationId),
      eq(project.slug, slug),
    ),
  });
}

export async function findProjectsForOrganization(organizationId: string) {
  return db.query.project.findMany({
    where: eq(project.organizationId, organizationId),
  });
}

export async function findProjectMembership(userId: string, projectId: string) {
  return db.query.projectMember.findFirst({
    where: and(
      eq(projectMember.userId, userId),
      eq(projectMember.projectId, projectId),
    ),
  });
}

export async function findProjectMembershipsForUser(userId: string) {
  return db.query.projectMember.findMany({
    where: eq(projectMember.userId, userId),
  });
}