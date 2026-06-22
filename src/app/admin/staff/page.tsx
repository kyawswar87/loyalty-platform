import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { requireRole } from "@/lib/authz";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateOperatorForm } from "../_components/forms";
import { setStaffRoleAction, toggleStaffStatusAction } from "../actions";

/** Staff account management: create, change role, enable/disable. */
export default async function StaffPage() {
  const me = await requireRole("admin");
  const rows = await db.select().from(users).orderBy(desc(users.createdAt));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Staff</h1>

      <Card>
        <CardHeader>
          <CardTitle>Create account</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateOperatorForm />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 font-medium">Name</th>
                <th className="py-2 font-medium">Role</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const isSelf = u.id === me.id;
                return (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="py-2">
                      <div className="font-medium">
                        {u.name}
                        {isSelf ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (you)
                          </span>
                        ) : null}
                      </div>
                      <div className="text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="py-2 capitalize">{u.role}</td>
                    <td className="py-2">
                      <span
                        className={
                          u.status === "active"
                            ? "text-emerald-600"
                            : "text-destructive"
                        }
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="py-2">
                      {isSelf ? (
                        <div className="text-right text-muted-foreground">—</div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <form action={setStaffRoleAction}>
                            <input type="hidden" name="id" value={u.id} />
                            <input
                              type="hidden"
                              name="role"
                              value={u.role === "admin" ? "operator" : "admin"}
                            />
                            <Button type="submit" size="sm" variant="outline">
                              Make {u.role === "admin" ? "operator" : "admin"}
                            </Button>
                          </form>
                          <form action={toggleStaffStatusAction}>
                            <input type="hidden" name="id" value={u.id} />
                            <input
                              type="hidden"
                              name="status"
                              value={u.status === "active" ? "disabled" : "active"}
                            />
                            <Button
                              type="submit"
                              size="sm"
                              variant={
                                u.status === "active" ? "destructive" : "outline"
                              }
                            >
                              {u.status === "active" ? "Disable" : "Enable"}
                            </Button>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
