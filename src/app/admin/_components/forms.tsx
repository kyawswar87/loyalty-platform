"use client";

import { useActionState } from "react";
import {
  createApiKeyAction,
  createOperatorAction,
  type ActionState,
  type CreateKeyState,
} from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateOperatorForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createOperatorAction,
    undefined,
  );
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" placeholder="Jordan Lee" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" placeholder="jordan@example.com" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Temporary password</Label>
        <Input id="password" name="password" type="text" placeholder="min 8 characters" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="role">Role</Label>
        <select
          id="role"
          name="role"
          defaultValue="operator"
          className="h-9 rounded-md border border-border bg-background px-2.5 text-sm shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="operator">Operator</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div className="flex items-center gap-4 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create account"}
        </Button>
        {state?.error ? (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : state?.ok ? (
          <p className="text-sm text-emerald-600">Account created.</p>
        ) : null}
      </div>
    </form>
  );
}

export function CreateApiKeyForm() {
  const [state, action, pending] = useActionState<CreateKeyState, FormData>(
    createApiKeyAction,
    undefined,
  );
  return (
    <div className="flex flex-col gap-3">
      <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="label">Label</Label>
          <Input id="label" name="label" placeholder="POS terminal 1" required />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Generating…" : "Create key"}
        </Button>
      </form>
      {state?.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      {state?.plain ? (
        <div className="rounded-md border border-emerald-600/30 bg-emerald-600/10 p-3 text-sm">
          <p className="font-medium text-emerald-700">
            Copy this key now — it won&apos;t be shown again:
          </p>
          <code className="mt-1 block font-mono break-all text-foreground">
            {state.plain}
          </code>
        </div>
      ) : null}
    </div>
  );
}
