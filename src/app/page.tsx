import { MarketingNav } from "@/components/marketing-nav";
import { Homepage } from "@/components/homepage";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <>
      <MarketingNav />
      <Homepage />
    </>
  );
}
