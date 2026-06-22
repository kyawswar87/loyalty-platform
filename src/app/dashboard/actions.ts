"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { customers, programConfig, redemptions, rewards } from "@/db/schema";
import { requireRole } from "@/lib/authz";
import {
  InsufficientBalanceError,
  recordPointChange,
} from "@/lib/points";
import { generateReferralCode } from "@/lib/vouchers";
import { getProgramConfig } from "@/lib/program";

export type ActionState = { error?: string; ok?: boolean } | undefined;

/**
 * Dashboard mutations. Each re-checks the operator role (also rejects disabled
 * accounts) and goes through the same `recordPointChange` primitive the POS API
 * uses, so dashboard and API balances stay consistent. Point mutations are
 * stamped with the acting staff user's id.
 */

const createCustomerSchema = z.object({
  externalId: z.string().min(1).max(255),
  email: z.string().email().max(255).optional().or(z.literal("")),
});

export async function createCustomerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole("operator");
  const parsed = createCustomerSchema.safeParse({
    externalId: String(formData.get("externalId") ?? ""),
    email: String(formData.get("email") ?? ""),
  });
  if (!parsed.success) return { error: "Enter a valid customer ID and email." };

  const email = parsed.data.email ? parsed.data.email : null;
  const config = await getProgramConfig();

  try {
    await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(customers)
        .values({
          externalId: parsed.data.externalId,
          email,
          referralCode: generateReferralCode(),
        })
        .onConflictDoNothing({ target: customers.externalId })
        .returning();

      if (!created) {
        throw new Error("DUPLICATE");
      }

      if (config.signupBonus > 0) {
        await recordPointChange(tx, {
          customerId: created.id,
          type: "adjust",
          points: config.signupBonus,
          reason: "Signup bonus",
          actorUserId: user.id,
        });
      }
    });
  } catch (err) {
    if (err instanceof Error && err.message === "DUPLICATE") {
      return { error: "A customer with that ID already exists." };
    }
    throw err;
  }

  revalidatePath("/dashboard/customers");
  return { ok: true };
}

const adjustSchema = z.object({
  customerId: z.string().uuid(),
  points: z.coerce.number().int().refine((n) => n !== 0, "Points must be non-zero."),
  reason: z.string().min(1).max(255),
});

export async function adjustPointsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole("operator");
  const parsed = adjustSchema.safeParse({
    customerId: String(formData.get("customerId") ?? ""),
    points: String(formData.get("points") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  });
  if (!parsed.success) {
    return { error: "Enter a non-zero point amount and a reason." };
  }

  try {
    await db.transaction(async (tx) => {
      await recordPointChange(tx, {
        customerId: parsed.data.customerId,
        type: "adjust",
        points: parsed.data.points,
        reason: parsed.data.reason,
        actorUserId: user.id,
      });
    });
  } catch (err) {
    if (err instanceof InsufficientBalanceError) {
      return { error: "Adjustment would drop the balance below zero." };
    }
    throw err;
  }

  revalidatePath(`/dashboard/customers/${parsed.data.customerId}`);
  return { ok: true };
}

const rewardSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional().or(z.literal("")),
  pointsCost: z.coerce.number().int().min(0),
  stock: z.string().optional(), // empty = unlimited
});

export async function createRewardAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("operator");
  const parsed = rewardSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    pointsCost: String(formData.get("pointsCost") ?? ""),
    stock: String(formData.get("stock") ?? ""),
  });
  if (!parsed.success) {
    return { error: "Enter a name and a non-negative points cost." };
  }

  const stockRaw = parsed.data.stock?.trim();
  const stock = stockRaw ? Number(stockRaw) : null;
  if (stock !== null && (!Number.isInteger(stock) || stock < 0)) {
    return { error: "Stock must be a non-negative whole number (or blank)." };
  }

  await db.insert(rewards).values({
    name: parsed.data.name,
    description: parsed.data.description ? parsed.data.description : null,
    pointsCost: parsed.data.pointsCost,
    stock,
  });

  revalidatePath("/dashboard/rewards");
  return { ok: true };
}

export async function toggleRewardAction(formData: FormData): Promise<void> {
  await requireRole("operator");
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!z.string().uuid().safeParse(id).success) return;

  await db.update(rewards).set({ active }).where(eq(rewards.id, id));
  revalidatePath("/dashboard/rewards");
}

const settingsSchema = z.object({
  earnRate: z.coerce.number().min(0),
  referralReferrerPoints: z.coerce.number().int().min(0),
  referralRefereePoints: z.coerce.number().int().min(0),
  signupBonus: z.coerce.number().int().min(0),
  currency: z.string().trim().length(3),
});

export async function updateSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("operator");
  const parsed = settingsSchema.safeParse({
    earnRate: String(formData.get("earnRate") ?? ""),
    referralReferrerPoints: String(formData.get("referralReferrerPoints") ?? ""),
    referralRefereePoints: String(formData.get("referralRefereePoints") ?? ""),
    signupBonus: String(formData.get("signupBonus") ?? ""),
    currency: String(formData.get("currency") ?? ""),
  });
  if (!parsed.success) return { error: "Check the values and try again." };

  await db
    .update(programConfig)
    .set({
      earnRate: String(parsed.data.earnRate),
      referralReferrerPoints: parsed.data.referralReferrerPoints,
      referralRefereePoints: parsed.data.referralRefereePoints,
      signupBonus: parsed.data.signupBonus,
      currency: parsed.data.currency.toUpperCase(),
    })
    .where(eq(programConfig.id, 1));

  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function useRedemptionAction(formData: FormData): Promise<void> {
  await requireRole("operator");
  const id = String(formData.get("id") ?? "");
  if (!z.string().uuid().safeParse(id).success) return;

  await db
    .update(redemptions)
    .set({ status: "used" })
    .where(and(eq(redemptions.id, id), eq(redemptions.status, "issued")));
  revalidatePath("/dashboard/redemptions");
}
