import { describe, expect, it } from "vitest";
import { stepsForTopic } from "@/components/VerificationSteps";
import { TOPICS } from "@/ontology";

describe("suggested verification steps", () => {
  it("covers every ontology topic, so no signal is left without a first move", () => {
    const missing = TOPICS.map((t) => t.id).filter((id) => !stepsForTopic(id));
    expect(missing).toEqual([]);
  });

  it("returns nothing for an unknown or absent topic rather than a generic step", () => {
    expect(stepsForTopic(null)).toBeNull();
    expect(stepsForTopic("not-a-topic")).toBeNull();
  });

  /*
   * These are suggestions to a person, produced by a system that has
   * verified nothing. They must not read as orders, and must not assert that
   * the reported problem is real.
   */
  it.each(TOPICS.map((t) => t.id))("phrases %s as a check, not an order", (id) => {
    for (const step of stepsForTopic(id) ?? []) {
      expect(step).toMatch(/^(Confirm|Check|Compare|Verify|Request|Ask)\b/);
      expect(step.toLowerCase()).not.toMatch(/\b(must|immediately|ensure that|shall|is required)\b/);
    }
  });
});
