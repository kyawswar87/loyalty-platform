import { count, desc, eq, gt, gte, lt, sql, sum } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  customers,
  pointTransactions,
  redemptions,
  rewards,
  users,
} from "@/db/schema";

const n = (v: string | number | null) => Number(v ?? 0);

/**
 * Admin analytics. Points issued/redeemed come straight from the ledger (the
 * source of truth): issued = sum of positive entries, redeemed = magnitude of
 * negative entries. Liability is the sum of outstanding customer balances.
 */
export async function getAnalytics() {
  const [
    [liability],
    [issued],
    [redeemed],
    [customerCount],
    [redemptionCount],
    topRewards,
    staffActivity,
  ] = await Promise.all([
    db.select({ v: sum(customers.pointsBalance) }).from(customers),
    db
      .select({ v: sum(pointTransactions.points) })
      .from(pointTransactions)
      .where(gt(pointTransactions.points, 0)),
    db
      .select({ v: sum(pointTransactions.points) })
      .from(pointTransactions)
      .where(lt(pointTransactions.points, 0)),
    db.select({ v: count() }).from(customers),
    db.select({ v: count() }).from(redemptions),
    db
      .select({
        name: rewards.name,
        redemptions: count(redemptions.id),
        pointsSpent: sum(redemptions.pointsSpent),
      })
      .from(redemptions)
      .innerJoin(rewards, eq(redemptions.rewardId, rewards.id))
      .groupBy(rewards.id, rewards.name)
      .orderBy(desc(count(redemptions.id)))
      .limit(5),
    db
      .select({
        name: users.name,
        email: users.email,
        actions: count(pointTransactions.id),
      })
      .from(pointTransactions)
      .innerJoin(users, eq(pointTransactions.actorUserId, users.id))
      .groupBy(users.id, users.name, users.email)
      .orderBy(desc(count(pointTransactions.id))),
  ]);

  return {
    customers: n(customerCount?.v ?? 0),
    pointsIssued: n(issued?.v ?? 0),
    pointsRedeemed: Math.abs(n(redeemed?.v ?? 0)),
    pointsLiability: n(liability?.v ?? 0),
    totalRedemptions: n(redemptionCount?.v ?? 0),
    topRewards: topRewards.map((r) => ({
      name: r.name,
      redemptions: n(r.redemptions),
      pointsSpent: n(r.pointsSpent),
    })),
    staffActivity: staffActivity.map((s) => ({
      name: s.name,
      email: s.email,
      actions: n(s.actions),
    })),
  };
}

export type DailyRedemptions = { date: string; redemptions: number };

/** Redemptions per day over the trailing `days` (gaps filled with zero). */
export async function getRedemptionsByDay(
  days = 14,
): Promise<DailyRedemptions[]> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (days - 1));

  const bucket = sql`date_trunc('day', ${redemptions.createdAt} AT TIME ZONE 'UTC')`;
  const rows = await db
    .select({
      day: sql<string>`to_char(${bucket}, 'YYYY-MM-DD')`,
      redemptions: count(),
    })
    .from(redemptions)
    .where(gte(redemptions.createdAt, since))
    .groupBy(bucket);

  const byDay = new Map(rows.map((r) => [r.day, n(r.redemptions)]));
  const out: DailyRedemptions[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setUTCDate(since.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key.slice(5), redemptions: byDay.get(key) ?? 0 });
  }
  return out;
}
