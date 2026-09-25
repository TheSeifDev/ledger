// Tables arrive with the phases that own them. Phase 1 adds Better Auth's
// tables; later phases add domain tables. `drizzle-kit generate` picks up
// whatever this directory exports.
export * from "./auth";
