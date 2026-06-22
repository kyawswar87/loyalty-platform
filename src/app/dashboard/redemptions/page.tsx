import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers, redemptions, rewards } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useRedemptionAction } from "../actions";

const STATUS_STYLES: Record<string, string> = {
  issued: "text-emerald-600",
  used: "text-muted-foreground",
  void: "text-destructive",
};

/** Issued vouchers with their status; operators can mark issued ones used. */
export default async function RedemptionsPage() {
  const rows = await db
    .select({
      id: redemptions.id,
      voucherCode: redemptions.voucherCode,
      status: redemptions.status,
      pointsSpent: redemptions.pointsSpent,
      createdAt: redemptions.createdAt,
      rewardName: rewards.name,
      customerExternalId: customers.externalId,
    })
    .from(redemptions)
    .innerJoin(rewards, eq(redemptions.rewardId, rewards.id))
    .innerJoin(customers, eq(redemptions.customerId, customers.id))
    .orderBy(desc(redemptions.createdAt))
    .limit(100);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Redemptions</h1>
      <Card>
        <CardContent className="pt-6">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No redemptions yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 font-medium">Voucher</th>
                  <th className="py-2 font-medium">Reward</th>
                  <th className="py-2 font-medium">Customer</th>
                  <th className="py-2 text-right font-medium">Points</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 font-mono text-xs">{r.voucherCode}</td>
                    <td className="py-2">{r.rewardName}</td>
                    <td className="py-2 text-muted-foreground">
                      {r.customerExternalId}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {r.pointsSpent.toLocaleString()}
                    </td>
                    <td className={`py-2 ${STATUS_STYLES[r.status] ?? ""}`}>
                      {r.status}
                    </td>
                    <td className="py-2 text-right">
                      {r.status === "issued" ? (
                        <form action={useRedemptionAction}>
                          <input type="hidden" name="id" value={r.id} />
                          <Button type="submit" size="sm" variant="outline">
                            Mark used
                          </Button>
                        </form>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
