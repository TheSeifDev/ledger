/**
 * Drizzle schema barrel.
 *
 * Tables arrive with the database phase (organizations, users, projects,
 * transactions, audit_logs — all organization-scoped).
 *
 * NOTE: drizzle-kit bundles everything this file imports when generating
 * migrations. Schema files in this directory must therefore use relative
 * imports only — no "@/..." path aliases.
 */
export {};
