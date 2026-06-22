import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { rewards } from "@/db/schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateRewardForm } from "../_components/forms";
import { toggleRewardAction } from "../actions";

/** Reward catalog: create + activate/deactivate. */
export default async function RewardsPage() {
  const rows = await db
    .select()
    .from(rewards)
    .orderBy(desc(rewards.createdAt));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Rewards</h1>

      <Card>
        <CardHeader>
          <CardTitle>New reward</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateRewardForm />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rewards yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 font-medium">Name</th>
                  <th className="py-2 text-right font-medium">Cost</th>
                  <th className="py-2 text-right font-medium">Stock</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2">
                      <div className="font-medium">{r.name}</div>
                      {r.description ? (
                        <div className="text-muted-foreground">
                          {r.description}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {r.pointsCost.toLocaleString()}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {r.stock === null ? "∞" : r.stock}
                    </td>
                    <td className="py-2">
                      <span
                        className={
                          r.active ? "text-emerald-600" : "text-muted-foreground"
                        }
                      >
                        {r.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <form action={toggleRewardAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <input
                          type="hidden"
                          name="active"
                          value={(!r.active).toString()}
                        />
                        <Button
                          type="submit"
                          size="sm"
                          variant={r.active ? "destructive" : "outline"}
                        >
                          {r.active ? "Deactivate" : "Activate"}
                        </Button>
                      </form>
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
