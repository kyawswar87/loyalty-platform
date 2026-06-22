import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { customers, pointTransactions } from "@/db/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AdjustPointsForm } from "../../_components/forms";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1);
  if (!customer) notFound();

  const ledger = await db
    .select()
    .from(pointTransactions)
    .where(eq(pointTransactions.customerId, id))
    .orderBy(desc(pointTransactions.createdAt))
    .limit(100);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/dashboard/customers"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Customers
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{customer.externalId}</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Balance</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {customer.pointsBalance.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Email</CardDescription>
            <CardTitle className="text-base">{customer.email ?? "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Referral code</CardDescription>
            <CardTitle className="text-base">{customer.referralCode}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Adjust points</CardTitle>
          <CardDescription>
            Manual credit or debit, recorded in the ledger and stamped with your
            account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdjustPointsForm customerId={customer.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ledger</CardTitle>
        </CardHeader>
        <CardContent>
          {ledger.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 font-medium">When</th>
                  <th className="py-2 font-medium">Type</th>
                  <th className="py-2 font-medium">Reason</th>
                  <th className="py-2 text-right font-medium">Points</th>
                  <th className="py-2 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((t) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="py-2 text-muted-foreground whitespace-nowrap">
                      {t.createdAt.toLocaleString()}
                    </td>
                    <td className="py-2">{t.type}</td>
                    <td className="py-2 text-muted-foreground">
                      {t.reason ?? t.reference ?? "—"}
                    </td>
                    <td
                      className={`py-2 text-right tabular-nums ${
                        t.points < 0 ? "text-destructive" : "text-emerald-600"
                      }`}
                    >
                      {t.points > 0 ? "+" : ""}
                      {t.points.toLocaleString()}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {t.balanceAfter.toLocaleString()}
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
