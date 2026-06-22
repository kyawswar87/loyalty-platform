import { redirect } from "next/navigation";

// The app has no public landing page yet — send root traffic to the dashboard.
// `proxy.ts` then routes by auth: signed-out → /login, signed-in → dashboard.
export default function Home() {
  redirect("/dashboard");
}
