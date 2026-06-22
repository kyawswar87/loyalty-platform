import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/authz";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  // Already signed in → skip the form.
  if (await getCurrentUser()) redirect("/dashboard");

  const { callbackUrl } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <LoginForm callbackUrl={callbackUrl ?? "/dashboard"} />
    </main>
  );
}
