import type { DefaultSession } from "next-auth";

/** Staff role, mirrors the `user_role` enum in db/schema.ts. */
type UserRole = "admin" | "operator";

declare module "next-auth" {
  /** Shape returned by `authorize` and exposed on the session. */
  interface User {
    role?: UserRole;
  }

  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
  }
}

// Augment the source module: `next-auth/jwt` only re-exports `JWT` from
// `@auth/core/jwt`, so augmenting it there doesn't merge into the original.
declare module "@auth/core/jwt" {
  interface JWT {
    userId?: string;
    role?: UserRole;
  }
}
