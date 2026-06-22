import { getAnalytics, getRedemptionsByDay } from "@/lib/analytics";
import { findBalanceMismatches } from "@/lib/integrity";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RedemptionsChart } from "./_components/analytics-charts";

export default async function AdminAnalyticsPage() {
  const [a, byDay, mismatches] = await Promise.all([
    getAnalytics(),
    getRedemptionsByDay(14),
    findBalanceMismatches(),
  ]);

  const stats = [
    { label: "Customers", value: a.customers },
    { label: "Points issued", value: a.pointsIssued },
    { label: "Points redeemed", value: a.pointsRedeemed },
    { label: "Points liability", value: a.pointsLiability },
    { label: "Redemptions", value: a.totalRedemptions },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Analytics</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader>
              <CardDescription>{s.label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {s.value.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Balance integrity</CardTitle>
          <CardDescription>
            Customer balances reconciled against the point ledger.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mismatches.length === 0 ? (
            <p className="text-sm text-emerald-600">
              ✓ All balances reconcile with the ledger.
            </p>
          ) : (
            <p className="text-sm text-destructive">
              ✗ {mismatches.length} customer(s) out of sync:{" "}
              {mismatches
                .slice(0, 5)
                .map((m) => m.externalId)
                .join(", ")}
              {mismatches.length > 5 ? "…" : ""}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Redemptions (last 14 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <RedemptionsChart data={byDay} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top rewards</CardTitle>
            <CardDescription>By number of redemptions.</CardDescription>
          </CardHeader>
          <CardContent>
            {a.topRewards.length === 0 ? (
              <p className="text-sm text-muted-foreground">No redemptions yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 font-medium">Reward</th>
                    <th className="py-2 text-right font-medium">Redemptions</th>
                    <th className="py-2 text-right font-medium">Points spent</th>
                  </tr>
                </thead>
                <tbody>
                  {a.topRewards.map((r) => (
                    <tr key={r.name} className="border-b last:border-0">
                      <td className="py-2">{r.name}</td>
                      <td className="py-2 text-right tabular-nums">
                        {r.redemptions.toLocaleString()}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {r.pointsSpent.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Staff activity</CardTitle>
            <CardDescription>Ledger entries by staff member.</CardDescription>
          </CardHeader>
          <CardContent>
            {a.staffActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No staff activity yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 font-medium">Staff</th>
                    <th className="py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {a.staffActivity.map((s) => (
                    <tr key={s.email} className="border-b last:border-0">
                      <td className="py-2">
                        <div className="font-medium">{s.name}</div>
                        <div className="text-muted-foreground">{s.email}</div>
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {s.actions.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
