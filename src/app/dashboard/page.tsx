import Link from "next/link";
import { count, eq, sum } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers, redemptions, rewards } from "@/db/schema";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** Operator overview: a few headline numbers + entry points. */
export default async function DashboardPage() {
  const [[customerStats], [rewardStats], [issuedStats]] = await Promise.all([
    db
      .select({
        total: count(),
        liability: sum(customers.pointsBalance),
      })
      .from(customers),
    db
      .select({ active: count() })
      .from(rewards)
      .where(eq(rewards.active, true)),
    db
      .select({ issued: count() })
      .from(redemptions)
      .where(eq(redemptions.status, "issued")),
  ]);

  const stats = [
    {
      label: "Customers",
      value: customerStats?.total ?? 0,
      href: "/dashboard/customers",
    },
    {
      label: "Points liability",
      value: Number(customerStats?.liability ?? 0),
      href: "/dashboard/customers",
    },
    {
      label: "Active rewards",
      value: rewardStats?.active ?? 0,
      href: "/dashboard/rewards",
    },
    {
      label: "Open vouchers",
      value: issuedStats?.issued ?? 0,
      href: "/dashboard/redemptions",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Overview</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="transition-colors hover:ring-foreground/20">
              <CardHeader>
                <CardDescription>{s.label}</CardDescription>
                <CardTitle className="text-2xl">
                  {s.value.toLocaleString()}
                </CardTitle>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
