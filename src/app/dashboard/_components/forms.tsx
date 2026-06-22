"use client";

import { useActionState } from "react";
import {
  adjustPointsAction,
  createCustomerAction,
  createRewardAction,
  updateSettingsAction,
  type ActionState,
} from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function FormFeedback({ state }: { state: ActionState }) {
  if (state?.error) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {state.error}
      </p>
    );
  }
  if (state?.ok) {
    return <p className="text-sm text-emerald-600">Saved.</p>;
  }
  return null;
}

export function CreateCustomerForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createCustomerAction,
    undefined,
  );
  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-2">
        <Label htmlFor="externalId">Customer ID</Label>
        <Input id="externalId" name="externalId" placeholder="pos-12345" required />
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <Label htmlFor="email">Email (optional)</Label>
        <Input id="email" name="email" type="email" placeholder="customer@example.com" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add customer"}
      </Button>
      <div className="sm:basis-full">
        <FormFeedback state={state} />
      </div>
    </form>
  );
}

export function AdjustPointsForm({ customerId }: { customerId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    adjustPointsAction,
    undefined,
  );
  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <input type="hidden" name="customerId" value={customerId} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="points">Points (+/−)</Label>
        <Input id="points" name="points" type="number" placeholder="-50" required className="w-32" />
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <Label htmlFor="reason">Reason</Label>
        <Input id="reason" name="reason" placeholder="Goodwill credit" required />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Applying…" : "Adjust"}
      </Button>
      <div className="sm:basis-full">
        <FormFeedback state={state} />
      </div>
    </form>
  );
}

export function CreateRewardForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createRewardAction,
    undefined,
  );
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" placeholder="Free coffee" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="pointsCost">Points cost</Label>
        <Input id="pointsCost" name="pointsCost" type="number" min={0} placeholder="50" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Input id="description" name="description" placeholder="One free drink" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="stock">Stock (blank = unlimited)</Label>
        <Input id="stock" name="stock" type="number" min={0} placeholder="" />
      </div>
      <div className="sm:col-span-2 flex items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create reward"}
        </Button>
        <FormFeedback state={state} />
      </div>
    </form>
  );
}

export function SettingsForm({
  defaults,
}: {
  defaults: {
    earnRate: string;
    referralReferrerPoints: number;
    referralRefereePoints: number;
    signupBonus: number;
    currency: string;
  };
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateSettingsAction,
    undefined,
  );
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <Label htmlFor="earnRate">Earn rate (points per 1 spent)</Label>
        <Input id="earnRate" name="earnRate" type="number" step="0.0001" min={0} defaultValue={defaults.earnRate} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="signupBonus">Signup bonus</Label>
        <Input id="signupBonus" name="signupBonus" type="number" min={0} defaultValue={defaults.signupBonus} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="referralReferrerPoints">Referral reward (referrer)</Label>
        <Input id="referralReferrerPoints" name="referralReferrerPoints" type="number" min={0} defaultValue={defaults.referralReferrerPoints} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="referralRefereePoints">Referral welcome (referee)</Label>
        <Input id="referralRefereePoints" name="referralRefereePoints" type="number" min={0} defaultValue={defaults.referralRefereePoints} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="currency">Currency (3-letter)</Label>
        <Input id="currency" name="currency" maxLength={3} defaultValue={defaults.currency} required className="w-28 uppercase" />
      </div>
      <div className="sm:col-span-2 flex items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
        <FormFeedback state={state} />
      </div>
    </form>
  );
}
