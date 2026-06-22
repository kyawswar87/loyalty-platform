import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys } from "@/db/schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateApiKeyForm } from "../_components/forms";
import { revokeApiKeyAction } from "../actions";

/** Business API keys for POS / e-commerce access. Only hashes are stored. */
export default async function ApiKeysPage() {
  const rows = await db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">API keys</h1>

      <Card>
        <CardHeader>
          <CardTitle>Create key</CardTitle>
          <CardDescription>
            The full key is shown once at creation. Only its hash is stored.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateApiKeyForm />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No API keys yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 font-medium">Label</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium">Last used</th>
                  <th className="py-2 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((k) => (
                  <tr key={k.id} className="border-b last:border-0">
                    <td className="py-2 font-medium">{k.label}</td>
                    <td className="py-2">
                      <span
                        className={
                          k.active ? "text-emerald-600" : "text-muted-foreground"
                        }
                      >
                        {k.active ? "Active" : "Revoked"}
                      </span>
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {k.lastUsedAt ? k.lastUsedAt.toLocaleString() : "Never"}
                    </td>
                    <td className="py-2 text-right">
                      {k.active ? (
                        <form action={revokeApiKeyAction}>
                          <input type="hidden" name="id" value={k.id} />
                          <Button type="submit" size="sm" variant="destructive">
                            Revoke
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
