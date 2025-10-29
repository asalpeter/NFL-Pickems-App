export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import ClientCallback from "./Client";

export default function Page() {
  return <ClientCallback />;
}
