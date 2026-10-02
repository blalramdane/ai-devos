import { OpenAIProvider } from "@openai/agents";
import type { Model, ModelProvider } from "@openai/agents";

export type ModelProviderKind = "openai" | "ollama" | "litellm" | "nvidia";

export interface ModelRoute {
  provider: ModelProviderKind;
  model: string;
  baseURL?: string;
  apiKey?: string;
  useResponses?: boolean;
}

export interface ModelRouterOptions {
  routes: Record<ModelProviderKind, ModelRoute>;
  defaultProvider?: ModelProviderKind;
}

export class ModelRouter implements ModelProvider {
  private readonly providers = new Map<ModelProviderKind, OpenAIProvider>();
  private readonly routes: Record<ModelProviderKind, ModelRoute>;
  private readonly defaultProvider: ModelProviderKind;

  constructor(options: ModelRouterOptions) {
    this.routes = options.routes;
    this.defaultProvider = options.defaultProvider ?? "openai";
  }

  async getModel(modelName?: string): Promise<Model> {
    const { provider, model } = this.resolve(modelName);
    let client = this.providers.get(provider);

    if (!client) {
      const route = this.routes[provider];
      client = new OpenAIProvider({
        apiKey: route.apiKey,
        baseURL: route.baseURL,
        useResponses: route.useResponses ?? false,
      });
      this.providers.set(provider, client);
    }

    return client.getModel(model);
  }

  async close(): Promise<void> {
    await Promise.all([...this.providers.values()].map((provider) => provider.close()));
    this.providers.clear();
  }

  private resolve(modelName?: string): { provider: ModelProviderKind; model: string } {
    if (modelName?.includes("/")) {
      const [prefix, ...rest] = modelName.split("/");
      if (prefix === "openai" || prefix === "ollama" || prefix === "litellm" || prefix === "nvidia") {
        return { provider: prefix, model: rest.join("/") };
      }
    }

    const route = this.routes[this.defaultProvider];
    return { provider: this.defaultProvider, model: modelName ?? route.model };
  }
}

export function createModelRouterFromEnv(env: NodeJS.ProcessEnv = process.env): ModelRouter {
  const openaiModel = env.AIDEVOS_OPENAI_MODEL ?? "gpt-5.6-luna";
  const ollamaModel = env.AIDEVOS_OLLAMA_MODEL ?? "qwen3:4b";
  const litellmModel = env.AIDEVOS_LITELLM_MODEL ?? openaiModel;
  const nvidiaModel = env.AIDEVOS_NVIDIA_MODEL ?? "openai/gpt-oss-20b";

  return new ModelRouter({
    defaultProvider: (env.AIDEVOS_DEFAULT_PROVIDER as ModelProviderKind | undefined) ?? "openai",
    routes: {
      openai: {
        provider: "openai",
        model: openaiModel,
        apiKey: env.OPENAI_API_KEY,
        useResponses: true,
      },
      ollama: {
        provider: "ollama",
        model: ollamaModel,
        baseURL: env.AIDEVOS_OLLAMA_BASE_URL ?? "http://127.0.0.1:11434/v1",
        apiKey: env.AIDEVOS_OLLAMA_API_KEY ?? "ollama",
        useResponses: false,
      },
      litellm: {
        provider: "litellm",
        model: litellmModel,
        baseURL: env.AIDEVOS_LITELLM_BASE_URL ?? "http://127.0.0.1:4000/v1",
        apiKey: env.AIDEVOS_LITELLM_API_KEY ?? env.OPENAI_API_KEY ?? "local",
        useResponses: false,
      },
      nvidia: {
        provider: "nvidia",
        model: nvidiaModel,
        baseURL: env.AIDEVOS_NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1",
        apiKey: env.NVIDIA_API_KEY,
        useResponses: false,
      },
    },
  });
}
