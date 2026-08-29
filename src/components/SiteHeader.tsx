import Link from "next/link";
import { SealMark } from "@/components/SealMark";
import { formatDateTime } from "@/lib/format";

const ENVIRONMENTS = {
  live: {
    label: "Live public data",
    className: "border-[rgba(26,107,69,0.35)] bg-[var(--positive-soft)] text-positive",
    detail: "Collected from public sources. AI interpretation is labelled throughout.",
  },
  verified_snapshot: {
    label: "Verified snapshot",
    className: "border-[rgba(29,78,216,0.3)] bg-[rgba(29,78,216,0.06)] text-[#1d4ed8]",
    detail: "Frozen capture of previously collected real public data.",
  },
  demo_seed: {
    label: "Development data",
    className: "border-[rgba(138,83,0,0.35)] bg-[var(--attention-soft)] text-emerging",
    detail: "Fictional demo_seed corpus. No real posts, people or claims.",
  },
} as const;

/**
 * Letterhead.
 *
 * Deliberately formal: mark, department line, closing rule. The authority of
 * the page comes from typography and structure rather than ornament, which is
 * the register a government reader trusts.
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
      {/*
        This system is designed FOR government use but is not a government
        property. On a public URL the letterhead styling alone could imply
        otherwise, so the status is stated above everything else and is not
        dismissible.
      */}
      <div className="bg-[var(--ink)] px-4 py-1.5 text-center sm:px-6">
        <span className="kicker text-[10.5px] text-[var(--paper)] opacity-90">
          {/* Three centred lines of tracked caps is most of a phone's first
              screen. The short form makes the same claim in one line; the
              full wording stays wherever there is room for it. */}
          <span className="sm:hidden">
            Independent prototype · not a Government of Telangana system
          </span>
          <span className="hidden sm:inline">
            Independent prototype · demonstration only · not affiliated with or endorsed by the
            Government of Telangana
          </span>
        </span>
      </div>
      {env && (
        <div className={`border-b px-4 py-1.5 text-left sm:px-6 sm:text-center ${env.className}`}>
          <span className="kicker">{env.label}</span>
          {/* Centred text that wraps loses its centre. Left-aligned below the
              label on mobile, inline on one line above it. */}
          <span className="ml-0 block text-[11px] leading-snug tracking-normal opacity-70 sm:ml-2 sm:inline">
            {env.detail}
          </span>
        </div>
      )}

      <header className="masthead-field bg-surface">
        <div className="mx-auto flex max-w-[1180px] items-center gap-5 px-4 py-4 sm:px-6 sm:py-6">
          <Link href="/" className="flex items-center gap-3 sm:gap-5">
            {/* The mark holds the letterhead together, but at full size it
                takes a fifth of a phone's width from the name beside it. */}
            <span className="shrink-0 [&>svg]:h-[38px] [&>svg]:w-[38px] sm:[&>svg]:h-[46px] sm:[&>svg]:w-[46px]">
              <SealMark size={46} />
            </span>
            <div>
              <div className="kicker text-seal">
                Telangana Agriculture · Public discourse monitoring
              </div>
              <div className="headline-serif mt-1 text-[21px] leading-none text-ink sm:text-[27px]">
                Agriculture Intelligence
              </div>
              <div className="mt-1.5 text-[11.5px] tracking-[0.02em] text-ink-muted">
                Prototype · not an official Government of Telangana system
              </div>
            </div>
          </Link>

          <div className="ml-auto hidden text-right sm:block">
            <div className="kicker text-ink-faint">Last updated</div>
            <div className="metric-number mt-0.5 text-[15px] text-ink-secondary">
              {formatDateTime(lastGeneratedAt)}
            </div>
            <div className="text-[11px] text-ink-faint">IST</div>
          </div>
        </div>
        {/* Institutional rule: a weight of green over a hairline, the way an
            official letterhead closes its header block. */}
        <div className="h-[3px] bg-[var(--seal)] opacity-90" />
        <div className="h-px bg-[var(--rule-strong)]" />
      </header>
    </>
  );
}
