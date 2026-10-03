import type { ModelRoute } from "./config.js";

export interface ModelCatalogEntry {
  id: string;
  name?: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  inputModalities?: string[];
  outputModalities?: string[];
  supportsTools?: boolean;
  supportsReasoning?: boolean;
  inputCostPerMillion?: number;
  outputCostPerMillion?: number;
  raw: Record<string, unknown>;
}

interface ModelsResponse {
  data?: Record<string, unknown>[];
  models?: Record<string, unknown>[];
}

function numberValue(...values: unknown[]): number | undefined {
  return values.find((value) => typeof value === "number") as number | undefined;
}

function boolValue(...values: unknown[]): boolean | undefined {
  return values.find((value) => typeof value === "boolean") as boolean | undefined;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result = value.filter((item): item is string => typeof item === "string");
  return result.length ? result : undefined;
}

export function normalizeModelCatalogEntry(raw: Record<string, unknown>): ModelCatalogEntry {
  const supports = (raw.supports ?? raw.capabilities ?? raw.supported_params) as Record<string, unknown> | undefined;

  return {
    id: String(raw.id ?? raw.slug ?? ""),
    name: typeof raw.name === "string" ? raw.name : typeof raw.display_name === "string" ? raw.display_name : undefined,
    contextWindow: numberValue(raw.context_window, raw.contextWindow, (raw.limits as Record<string, unknown> | undefined)?.context),
    maxOutputTokens: numberValue(raw.max_output_tokens, raw.maxOutputTokens, (raw.limits as Record<string, unknown> | undefined)?.output),
    inputModalities: stringArray(raw.input_modalities ?? raw.inputModalities),
    outputModalities: stringArray(raw.output_modalities ?? raw.outputModalities),
    supportsTools: boolValue(
      raw.tools,
      raw.tool_calling,
      raw.toolCalling,
      supports?.tools,
      supports?.tool_calling,
      supports?.toolCalling,
    ),
    supportsReasoning: boolValue(
      raw.reasoning,
      supports?.reasoning,
    ),
    inputCostPerMillion: numberValue(raw.input_cost_per_million, raw.inputCostPerMillion, raw.input_price_per_million, raw.inputPricePerMillion, (raw.pricing as Record<string, unknown> | undefined)?.input_per_million, (raw.pricing as Record<string, unknown> | undefined)?.input),
    outputCostPerMillion: numberValue(raw.output_cost_per_million, raw.outputCostPerMillion, raw.output_price_per_million, raw.outputPricePerMillion, (raw.pricing as Record<string, unknown> | undefined)?.output_per_million, (raw.pricing as Record<string, unknown> | undefined)?.output),
    raw,
  };
}

export class ExperientialCatalogClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  async list(): Promise<ModelCatalogEntry[]> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/models`, {
      headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : undefined,
    });

    if (!response.ok) {
      throw new Error(`Experiential model catalog request failed: HTTP ${response.status}`);
    }

    const payload = (await response.json()) as ModelsResponse | Record<string, unknown>[];
    const rows = Array.isArray(payload) ? payload : payload.data ?? payload.models ?? [];

    return rows
      .map(normalizeModelCatalogEntry)
      .filter((model) => model.id.length > 0);
  }

  async find(modelId: string): Promise<ModelCatalogEntry | undefined> {
    const models = await this.list();
    return models.find((model) => model.id === modelId);
  }
}

export async function loadExperientialCatalog(routes: ModelRoute[]): Promise<ModelCatalogEntry[]> {
  const experiential = routes.find((route) => route.provider === "experiential");
  if (!experiential) return [];

  return new ExperientialCatalogClient(experiential.baseUrl, experiential.apiKey).list();
}
