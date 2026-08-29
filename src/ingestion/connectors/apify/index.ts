/**
 * Apify adapter seam — the generic bridge that lets Phase 3 plug Apify
 * actors in as additional sources without touching the pipeline.
 *
 * An Apify-backed source is described declaratively:
 *   actor id + input builder + result-to-raw-item parser
 * and the platform normalizers (src/ingestion/normalization) handle the rest,
 * exactly as for first-party connectors. Nothing downstream ever sees Apify
 * response shapes.
 *
 * Dormant without APIFY_API_TOKEN. No actors are registered in Phase 2 —
 * this seam exists so adding one is configuration, not architecture.
 */
import type {
  CollectionQuery,
  NormalizedMention,
  Platform,
  RawSourceItem,
  SourceConnector,
} from "@/types/core";
import { normalizeRawItem } from "@/ingestion/normalization";

const APIFY_API = "https://api.apify.com/v2";

export interface ApifySourceSpec {
  /** Connector registry key, e.g. "apify-x-search". */
  key: string;
  platform: Platform;
  /** Apify actor id, e.g. "apidojo/tweet-scraper". */
  actorId: string;
  /** Build the actor input from a scheduler query. */
  buildInput(query: CollectionQuery): Record<string, unknown>;
  /**
   * Convert one dataset item into a RawSourceItem payload + external id.
   * Return null to skip malformed items.
   */
  parseItem(item: unknown): { externalId: string; payload: unknown } | null;
}

export class ApifyConnectorAdapter implements SourceConnector {
  key: string;
  platform: Platform;

  constructor(
    private spec: ApifySourceSpec,
    private token = process.env.APIFY_API_TOKEN,
  ) {
    this.key = spec.key;
    this.platform = spec.platform;
  }

  get isConfigured(): boolean {
    return Boolean(this.token);
  }

  /** Injectable for tests. */
  runActor: (actorId: string, input: Record<string, unknown>) => Promise<unknown[]> = async (
    actorId,
    input,
  ) => {
    const response = await fetch(
      `${APIFY_API}/acts/${actorId.replace("/", "~")}/run-sync-get-dataset-items?token=${this.token}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(120000),
      },
    );
    if (!response.ok) {
      throw new Error(`Apify actor ${actorId} failed: HTTP ${response.status}`);
    }
    return (await response.json()) as unknown[];
  };

  async collect(query: CollectionQuery): Promise<RawSourceItem[]> {
    if (!this.token) throw new Error("APIFY_API_TOKEN is not configured");
    const items = await this.runActor(this.spec.actorId, this.spec.buildInput(query));
    const collectedAt = new Date();
    return items.flatMap((item) => {
      const parsed = this.spec.parseItem(item);
      if (!parsed) return [];
      return [
        {
          platform: this.platform,
          externalId: parsed.externalId,
          payload: parsed.payload,
          collectedAt,
          dataOrigin: "live" as const,
        },
      ];
    });
  }

  async normalize(item: RawSourceItem): Promise<NormalizedMention> {
    // Every registered source records publishedAt on its payload; parse it
    // here so the pipeline receives a real timestamp rather than null.
    const payload = item.payload as { publishedAt?: string | null } | null;
    const raw = payload?.publishedAt ?? null;
    const parsed = raw ? new Date(raw) : null;
    return normalizeRawItem(item, {
      publishedAt: parsed && !Number.isNaN(parsed.getTime()) ? parsed : null,
    });
  }
}
