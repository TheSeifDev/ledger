import "server-only";

import { getSession } from "@/server/session";

export interface AuthResult {
  user: { id: string; email: string; name: string };
  session: { token: string; expiresAt: Date };
}

export async function requireAuthenticatedUser(): Promise<AuthResult> {
  const session = await getSession();
  if (!session) {
    throw new AuthorizationError("Authentication required");
  }
  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    },
    session: {
      token: session.session.token,
      expiresAt: session.session.expiresAt,
    },
  };
}

export class AuthorizationError extends Error {
  constructor(
    message: string,
    public readonly code: string = "FORBIDDEN",
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}