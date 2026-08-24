import Link from "next/link";
import { formatDateTime } from "@/lib/format";

/**
 * Global masthead. The environment ribbon is derived from data actually in
 * the database — when any demo_seed data is present, the surface says so,
 * unmissably. Nothing seeded is ever presented as live intelligence.
 */
export function SiteHeader({
  origins,
  lastGeneratedAt,
}: {
  origins: string[];
  lastGeneratedAt: Date | null;
}) {
  const isDemoSeed = origins.includes("demo_seed");
  const isLive = origins.includes("live");
  return (
    <>
      {isDemoSeed && !isLive && (
        <div className="border-b border-[rgba(229,168,59,0.3)] bg-[rgba(229,168,59,0.07)] px-6 py-1.5 text-center">
          <span className="kicker text-emerging">
            Development data — fictional demo_seed corpus. No real posts, people or claims.
          </span>
        </div>
      )}
      <header className="masthead-field border-b border-border">
        <div className="mx-auto flex max-w-[1200px] items-end justify-between px-6 py-5">
          <Link href="/" className="group">
            <div className="kicker text-ink-muted">తెలంగాణ · Government of Telangana</div>
            <div className="headline-serif mt-1 text-[22px] text-ink">
              Agriculture Intelligence
              <span className="text-ink-muted"> · Command Centre</span>
            </div>
          </Link>
          <div className="text-right text-[12px] text-ink-faint">
            <div className="kicker text-ink-faint">Intelligence updated</div>
            <div className="mt-0.5 text-ink-muted">{formatDateTime(lastGeneratedAt)} IST</div>
          </div>
        </div>
      </header>
    </>
  );
}
