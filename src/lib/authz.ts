import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/db/schema";

export type Role = "admin" | "operator";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

/**
 * The authoritative ("secure") staff identity for the current request.
 *
 * Reads the JWT session via `auth()`, then re-reads the user row to confirm the
 * account still exists and is `active`. This is what makes a disabled account
 * lose access immediately, rather than only when its token expires. Wrapped in
 * React `cache()` so multiple checks in one render pass hit the DB once.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.id, id),
  });
  if (!user || user.status !== "active") return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
});

/** Require any active staff user; redirect to /login otherwise. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Admin inherits every Operator permission. */
function satisfiesRole(actual: Role, required: Role): boolean {
  if (actual === "admin") return true;
  return actual === required;
}

/**
 * Require a specific role for a page or Server Action.
 * - unauthenticated → /login
 * - authenticated but wrong role → /dashboard (no privilege escalation)
 */
export async function requireRole(required: Role): Promise<CurrentUser> {
  const user = await requireUser();
  if (!satisfiesRole(user.role, required)) redirect("/dashboard");
  return user;
}
