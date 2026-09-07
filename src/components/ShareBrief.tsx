"use client";

/**
 * Share a signal as text, in English or Telugu.
 *
 * Phones are where this is read, so WhatsApp is where it will be passed on —
 * an officer forwarding a line to a district colleague is the actual
 * distribution mechanism, not a login. The native share sheet is used when
 * the browser has one, and the clipboard otherwise.
 *
 * The Telugu text is composed from fixed strings and ontology district names,
 * never generated at send time. A brief that leaves an officer's phone under
 * their name has to say the same thing every time, and a model asked to
 * translate on the fly could quietly soften "reported" into "confirmed".
 */
import { useState } from "react";
import { DISTRICTS } from "@/ontology";

const TE_BY_EN = new Map(DISTRICTS.filter((d) => d.te).map((d) => [d.en, d.te!]));

export interface ShareableSignal {
  headline: string;
  districts: string[];
  voices: number;
  url: string;
}

/** Three names then a count, matching the cards. */
function districtPhrase(districts: string[], telugu: boolean): string {
  const named = districts.slice(0, 3).map((d) => (telugu ? (TE_BY_EN.get(d) ?? d) : d));
  const rest = districts.length - named.length;
  const list = named.join(", ");
  if (rest <= 0) return list;
  return telugu ? `${list} మరియు మరో ${rest} జిల్లాలు` : `${list} and ${rest} more districts`;
}

export function briefText(signal: ShareableSignal, telugu: boolean): string {
  const date = new Date().toLocaleDateString(telugu ? "te-IN" : "en-IN", {
    day: "numeric",
    month: "short",
  });
  const where = signal.districts.length > 0 ? districtPhrase(signal.districts, telugu) : null;

  /*
   * "Reported" and "recommended", never "confirmed" or "required". This
   * leaves the building under an officer's name, so it must not assert a
   * field condition the system has not established or issue an instruction
   * it has no standing to give.
   */
  if (telugu) {
    return [
      `వ్యవసాయ ప్రజా సంకేతం — ${date}`,
      "",
      `${signal.headline}`,
      where ? `ఆధారాలు: ${where}.` : null,
      `${signal.voices} స్వతంత్ర గొంతులు గుర్తించబడ్డాయి.`,
      "క్షేత్రస్థాయి ధ్రువీకరణ సిఫార్సు చేయబడింది.",
      "",
      signal.url,
      "ఆధారం: Agriculture Intelligence (ప్రయోగాత్మక వ్యవస్థ).",
    ]
      .filter((l) => l !== null)
      .join("\n");
  }
  return [
    `Agriculture public signal — ${date}`,
    "",
    `${signal.headline}`,
    where ? `Evidence in ${where}.` : null,
    `${signal.voices} independent voices identified.`,
    "Field verification recommended.",
    "",
    signal.url,
    "Source: Agriculture Intelligence (pilot system).",
  ]
    .filter((l) => l !== null)
    .join("\n");
}

export function ShareBrief({ signal }: { signal: ShareableSignal }) {
  const [done, setDone] = useState<string | null>(null);

  async function share(telugu: boolean) {
    const text = briefText(signal, telugu);
    const label = telugu ? "telugu" : "english";
    try {
      // The share sheet is the point on a phone: it reaches WhatsApp directly.
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setDone(label);
      setTimeout(() => setDone(null), 2500);
    } catch {
      // A cancelled share sheet throws too; nothing here is worth an error.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {[
        { telugu: false, label: "Share brief" },
        { telugu: true, label: "తెలుగులో కాపీ" },
      ].map((b) => (
        <button
          key={b.label}
          type="button"
          onClick={(e) => {
            // These sit inside a link to the finding; sharing is not navigating.
            e.preventDefault();
            e.stopPropagation();
            void share(b.telugu);
          }}
          className="min-h-[36px] rounded-md border border-border-strong px-3 text-[12.5px] font-medium text-ink-secondary transition-colors hover:bg-surface-2 hover:text-ink"
        >
          {done === (b.telugu ? "telugu" : "english") ? "Copied" : b.label}
        </button>
      ))}
    </div>
  );
}
