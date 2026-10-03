import { resolve } from "node:path";

export type ProviderKind = "ollama" | "openai" | "compatible";

export interface DevOSConfig {
  provider: ProviderKind;
  baseUrl: string;
  apiKey: string;
  model: string;
  dataDir: string;
  maxTurns: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): DevOSConfig {
  const provider = (env.AIDEVOS_PROVIDER ?? "ollama") as ProviderKind;
  if (!["ollama", "openai", "compatible"].includes(provider)) {
    throw new Error(`Unsupported AIDEVOS_PROVIDER: ${provider}`);
  }

  const baseUrl =
    env.AIDEVOS_BASE_URL ??
    (provider === "ollama"
      ? "http://127.0.0.1:11434/v1"
      : "https://api.openai.com/v1");

  const apiKey =
    env.AIDEVOS_API_KEY ??
    (provider === "ollama" ? "ollama" : env.OPENAI_API_KEY ?? "");

  const model =
    env.AIDEVOS_MODEL ??
    (provider === "ollama" ? "qwen3:4b" : "gpt-5.6-luna");

  return {
    provider,
    baseUrl: baseUrl.replace(/\/$/, ""),
    apiKey,
    model,
    dataDir: resolve(env.AIDEVOS_DATA_DIR ?? ".aidevos"),
    maxTurns: Number(env.AIDEVOS_MAX_TURNS ?? 30),
  };
}
