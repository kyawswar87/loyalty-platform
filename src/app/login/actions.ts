"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export type LoginState = { error?: string } | undefined;

/**
 * Server Action for the credentials login form.
 *
 * On success `signIn` throws a redirect (to `callbackUrl` or /dashboard), which
 * must propagate. On bad credentials Auth.js throws an `AuthError`, which we
 * turn into a generic field error (never reveal which field was wrong).
 */
export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "/dashboard");

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: callbackUrl || "/dashboard",
    });
    return undefined;
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    // Redirects (and anything else) must bubble up.
    throw error;
  }
}
