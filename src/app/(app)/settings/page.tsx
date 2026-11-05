import { SettingsPage } from "@/components/settings/Settings";
import { requireTeam } from "@/lib/auth";

export default async function Page() {
  const s = await requireTeam();
  return <SettingsPage role={s.role} />;
}
