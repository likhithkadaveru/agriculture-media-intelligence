/**
 * Suggested first checks for a signal, written per topic.
 *
 * FIXED TEXT, NEVER GENERATED. A model asked to propose actions for a
 * government officer can invent a plausible-sounding instruction — name a
 * scheme that does not exist, or imply an authority the system has no
 * standing to exercise. These are written once, reviewed once, and keyed to
 * an ontology topic id, so the worst failure available is a step that is
 * merely unhelpful rather than one that is wrong and confident.
 *
 * They are prompts for a person deciding what to do, never instructions.
 * The heading and the closing line both say so, because this is the point in
 * the interface where a monitoring tool most resembles a directive.
 */
const STEPS: Record<string, string[]> = {
  "fertilizer-availability": [
    "Confirm dealer-level stock and dispatch position in the named districts.",
    "Check for queue or biometric-processing delays at sale points.",
    "Compare public reports against the current allocation and offtake.",
  ],
  seeds: [
    "Confirm certified seed availability with the distributing agency.",
    "Check for reported germination or quality complaints at the mandal level.",
    "Verify licensing status of the dealers named in reports.",
  ],
  rainfall: [
    "Compare reports against the rain-gauge record for the named mandals.",
    "Ask district officers for a standing-crop damage assessment.",
    "Check whether the affected extent is under insurance cover.",
  ],
  "crop-damage": [
    "Request a field damage assessment for the named districts.",
    "Check crop-insurance enrolment and claim status for the affected extent.",
    "Confirm whether an enumeration has already been commissioned.",
  ],
  procurement: [
    "Confirm the operating status of purchase centres in the named districts.",
    "Check payment-release timelines against reported delays.",
    "Verify gunny, transport and storage readiness at those centres.",
  ],
  "market-price": [
    "Compare reported rates against the market committee's recorded arrivals.",
    "Check whether procurement at the support price is operating locally.",
    "Confirm commission-agent and trader activity at the named yards.",
  ],
  "farmer-support-schemes": [
    "Check disbursement status for the scheme named in the reports.",
    "Confirm whether the reported grievances concern eligibility or payment.",
    "Verify the district-level enrolment position.",
  ],
  irrigation: [
    "Confirm the release schedule and current position for the named command area.",
    "Check reported supply failures with the irrigation authority.",
    "Verify whether the shortfall is distributional or one of source.",
  ],
  "pest-outbreak": [
    "Request scouting reports for the named mandals.",
    "Confirm advisory reach and plant-protection input availability.",
    "Check whether the incidence is above the economic threshold.",
  ],
  "agricultural-power": [
    "Confirm supply hours actually delivered against the schedule.",
    "Check transformer failure and replacement times in the named districts.",
  ],
  "agricultural-credit": [
    "Check disbursement against target for the reported period.",
    "Confirm whether the reports concern fresh lending or renewal.",
  ],
  "input-cost": [
    "Compare reported prices against notified rates.",
    "Check for enforcement action already recorded against sellers.",
  ],
  "farm-mechanisation": [
    "Confirm subsidy release and machinery availability position.",
    "Check reported delays in sanction or delivery.",
  ],
};

/** Steps for a topic, or null where none are written. */
export function stepsForTopic(topic: string | null): string[] | null {
  if (!topic) return null;
  return STEPS[topic] ?? null;
}

export function VerificationSteps({
  topic,
  districts,
}: {
  topic: string | null;
  districts: string[];
}) {
  const steps = stepsForTopic(topic);
  if (!steps) return null;
  const where = districts.slice(0, 3).join(", ");

  return (
    <div className="mt-5 rounded-md border border-border bg-surface-2 p-4">
      <h4 className="kicker text-ink-faint">Suggested verification</h4>
      <ul className="mt-2.5 space-y-1.5">
        {steps.map((step) => (
          <li key={step} className="flex gap-2 text-[13.5px] leading-snug text-ink-secondary">
            <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--rule-strong)]" />
            <span>{step}</span>
          </li>
        ))}
      </ul>
      {where && (
        <p className="mt-2.5 text-[12.5px] text-ink-faint">
          Evidence is strongest in {where}.
        </p>
      )}
      {/*
        The disclaimer is not boilerplate here. This block is the one place
        the interface reads like an instruction, and it is produced by a
        system that monitors public information and has verified nothing.
      */}
      <p className="mt-3 border-t border-border pt-2.5 text-[11.5px] leading-snug text-ink-faint">
        Suggested starting points based on the reported topic. Not a
        departmental instruction, and not derived from any verified field
        assessment.
      </p>
    </div>
  );
}
