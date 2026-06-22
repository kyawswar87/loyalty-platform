"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { hash } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiKeys, users } from "@/db/schema";
import { requireRole } from "@/lib/authz";
import { generateApiKey } from "@/lib/apiKey";

export type ActionState = { error?: string; ok?: boolean } | undefined;
/** API-key creation returns the plaintext once, for display. */
export type CreateKeyState =
  | { error?: string; plain?: undefined }
  | { error?: undefined; plain: string }
  | undefined;

const createOperatorSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  password: z.string().min(8).max(255),
  role: z.enum(["admin", "operator"]),
});

export async function createOperatorAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("admin");
  const parsed = createOperatorSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    role: String(formData.get("role") ?? "operator"),
  });
  if (!parsed.success) {
    return { error: "Name, email, role, and an 8+ char password are required." };
  }

  const email = parsed.data.email.trim().toLowerCase();
  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existing) return { error: "A user with that email already exists." };

  await db.insert(users).values({
    name: parsed.data.name,
    email,
    passwordHash: await hash(parsed.data.password, 10),
    role: parsed.data.role,
    status: "active",
  });

  revalidatePath("/admin/staff");
  return { ok: true };
}

const userIdSchema = z.string().uuid();

/** Toggle a staff account between active/disabled. Cannot disable yourself. */
export async function toggleStaffStatusAction(formData: FormData): Promise<void> {
  const me = await requireRole("admin");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!userIdSchema.safeParse(id).success) return;
  if (id === me.id) return; // never lock yourself out
  if (status !== "active" && status !== "disabled") return;

  await db.update(users).set({ status }).where(eq(users.id, id));
  revalidatePath("/admin/staff");
}

/** Toggle a staff member's role. Cannot change your own role. */
export async function setStaffRoleAction(formData: FormData): Promise<void> {
  const me = await requireRole("admin");
  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!userIdSchema.safeParse(id).success) return;
  if (id === me.id) return;
  if (role !== "admin" && role !== "operator") return;

  await db.update(users).set({ role }).where(eq(users.id, id));
  revalidatePath("/admin/staff");
}

const createKeySchema = z.object({ label: z.string().min(1).max(255) });

export async function createApiKeyAction(
  _prev: CreateKeyState,
  formData: FormData,
): Promise<CreateKeyState> {
  await requireRole("admin");
  const parsed = createKeySchema.safeParse({
    label: String(formData.get("label") ?? ""),
  });
  if (!parsed.success) return { error: "Enter a label for the key." };

  const { plain, hashedKey } = generateApiKey();
  await db.insert(apiKeys).values({ label: parsed.data.label, hashedKey });

  revalidatePath("/admin/api-keys");
  return { plain };
}

/** Revoke (deactivate) an API key. */
export async function revokeApiKeyAction(formData: FormData): Promise<void> {
  await requireRole("admin");
  const id = String(formData.get("id") ?? "");
  if (!userIdSchema.safeParse(id).success) return;

  await db.update(apiKeys).set({ active: false }).where(eq(apiKeys.id, id));
  revalidatePath("/admin/api-keys");
}
