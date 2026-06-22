import Link from "next/link";
import { desc, ilike, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers } from "@/db/schema";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateCustomerForm } from "../_components/forms";

/** Searchable customer list + manual create. */
export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const term = q?.trim();

  const rows = await db
    .select()
    .from(customers)
    .where(
      term
        ? or(
            ilike(customers.externalId, `%${term}%`),
            ilike(customers.email, `%${term}%`),
            ilike(customers.referralCode, `%${term}%`),
          )
        : undefined,
    )
    .orderBy(desc(customers.createdAt))
    .limit(50);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Customers</h1>

      <Card>
        <CardHeader>
          <CardTitle>Add a customer</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateCustomerForm />
        </CardContent>
      </Card>

      <form className="flex gap-2" action="/dashboard/customers">
        <Input
          name="q"
          defaultValue={term ?? ""}
          placeholder="Search by ID, email, or referral code"
          className="max-w-sm"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      <Card>
        <CardContent className="pt-6">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No customers found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 font-medium">Customer ID</th>
                  <th className="py-2 font-medium">Email</th>
                  <th className="py-2 font-medium">Referral</th>
                  <th className="py-2 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-2">
                      <Link
                        href={`/dashboard/customers/${c.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {c.externalId}
                      </Link>
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {c.email ?? "—"}
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {c.referralCode}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {c.pointsBalance.toLocaleString()}
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
