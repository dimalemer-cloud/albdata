import { Clients } from "@/components/settings/Clients";
import { appUrl } from "@/lib/workspace";

export default function Page() {
  return <Clients appUrl={appUrl()} />;
}
