import Link from "next/link";
import { formatDateTime } from "@/lib/format";

const ENVIRONMENTS = {
  live: {
    label: "Live public data",
    className: "border-[rgba(111,191,142,0.3)] bg-[rgba(111,191,142,0.07)] text-positive",
    detail: "Collected from public sources. AI interpretation is labelled throughout.",
  },
  verified_snapshot: {
    label: "Verified snapshot",
    className: "border-[rgba(57,135,229,0.3)] bg-[rgba(57,135,229,0.07)] text-[#7fb2f0]",
    detail: "Frozen capture of previously collected real public data.",
  },
  demo_seed: {
    label: "Development data",
    className: "border-[rgba(229,168,59,0.3)] bg-[rgba(229,168,59,0.07)] text-emerging",
    detail: "Fictional demo_seed corpus. No real posts, people or claims.",
  },
} as const;


/**
 * Global masthead. The environment ribbon is computed from the lineage of
 * the active findings, so what the user sees always states which kind of
 * evidence produced it.
 */
export function SiteHeader({
  activeOrigin,
  lastGeneratedAt,
}: {
  activeOrigin: "live" | "verified_snapshot" | "demo_seed" | null;
  lastGeneratedAt: Date | null;
}) {
  const env = activeOrigin ? ENVIRONMENTS[activeOrigin] : null;
  return (
    <>
      {env && (
        <div className={`border-b px-6 py-1.5 text-center ${env.className}`}>
          <span className="kicker">{env.label}</span>
          <span className="ml-2 text-[11px] tracking-normal opacity-70">{env.detail}</span>
        </div>
      )}
      <header className="masthead-field border-b border-border">
        <div className="mx-auto flex max-w-[1200px] items-end justify-between gap-6 px-6 py-5">
          <Link href="/" className="group">
            <div className="kicker text-ink-muted">తెలంగాణ · Government of Telangana</div>
            <div className="headline-serif mt-1 text-[22px] text-ink">
              Agriculture Intelligence
              <span className="text-ink-muted"> · Command Centre</span>
            </div>
          </Link>
          <div className="flex items-end gap-6">
            <div className="text-right text-[12px] text-ink-faint">
              <div className="kicker text-ink-faint">Updated</div>
              <div className="mt-0.5 text-ink-muted">{formatDateTime(lastGeneratedAt)} IST</div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
