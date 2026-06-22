import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getProgramConfig } from "@/lib/program";
import { SettingsForm } from "../_components/forms";

/** Program configuration — the singleton `program_config` row. */
export default async function SettingsPage() {
  const config = await getProgramConfig();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Program settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Points &amp; rewards</CardTitle>
          <CardDescription>
            Earn rate, referral rewards, signup bonus, and currency. Applies to
            all earns and referrals going forward.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm
            defaults={{
              earnRate: config.earnRate,
              referralReferrerPoints: config.referralReferrerPoints,
              referralRefereePoints: config.referralRefereePoints,
              signupBonus: config.signupBonus,
              currency: config.currency,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
