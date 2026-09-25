// Phase 0 ships this barrel empty on purpose: tables arrive with the phases
// that own them (Phase 1: Better Auth, later phases: domain tables), and
// `drizzle-kit generate` picks up whatever this directory exports.
export {};
