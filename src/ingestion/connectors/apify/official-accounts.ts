/**
 * Known official Government of Telangana accounts on X.
 *
 * These are *institutional* accounts — departments and offices, not private
 * individuals. Flagging them matters because the official-versus-public
 * comparison is only meaningful if the official position is correctly
 * identified; an unflagged department statement would be counted as one more
 * public voice, which would quietly understate any divergence.
 *
 * Rules for this list:
 *  - Institutional accounts only. No personal accounts, no politicians'
 *    personal handles, no party accounts. A minister's departmental office
 *    qualifies; the minister's own campaigning account does not.
 *  - Every entry must be observed in collected data or verified before it is
 *    added. Guessed handles would silently mislabel whoever holds them.
 *
 * Enrichment still classifies author type independently and records its own
 * confidence; this only sets the prior.
 */

export interface OfficialAccount {
  /** Lowercase handle, without the leading @. */
  handle: string;
  name: string;
  note?: string;
}

export const OFFICIAL_X_ACCOUNTS: OfficialAccount[] = [
  {
    handle: "iprtelangana",
    name: "Information & Public Relations Department, Telangana",
    note: "Observed in live collection — the state's official communications channel",
  },
];

const BY_HANDLE = new Map(OFFICIAL_X_ACCOUNTS.map((a) => [a.handle, a]));

export function isOfficialXHandle(handle: string | null | undefined): boolean {
  if (!handle) return false;
  return BY_HANDLE.has(handle.replace(/^@/, "").toLowerCase());
}
