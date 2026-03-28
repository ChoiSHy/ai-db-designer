export type Provider = "anthropic" | "openai";

export interface ModelInfo {
  id: string;
  name: string;
}

export interface ProviderInfo {
  id: Provider;
  name: string;
  shortName: string;
  models: ModelInfo[];
  keyPlaceholder: string;
  /** true = .env.local 키가 있으면 빈 값도 동작 */
  supportsEnvFallback: boolean;
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    shortName: "Claude",
    models: [
      { id: "claude-sonnet-4-6",          name: "Claude Sonnet 4.6"  },
      { id: "claude-opus-4-6",             name: "Claude Opus 4.6"   },
      { id: "claude-haiku-4-5-20251001",   name: "Claude Haiku 4.5"  },
    ],
    keyPlaceholder: "sk-ant-api03-...",
    supportsEnvFallback: true,
  },
  {
    id: "openai",
    name: "OpenAI",
    shortName: "OpenAI",
    models: [
      { id: "gpt-4o",       name: "GPT-4o"       },
      { id: "gpt-4o-mini",  name: "GPT-4o mini"  },
      { id: "gpt-4-turbo",  name: "GPT-4 Turbo"  },
      { id: "o3-mini",      name: "o3-mini"       },
    ],
    keyPlaceholder: "sk-...",
    supportsEnvFallback: false,
  },
];

export function getProvider(id: Provider): ProviderInfo {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}

export function getModel(provider: Provider, modelId: string): ModelInfo {
  const p = getProvider(provider);
  return p.models.find((m) => m.id === modelId) ?? p.models[0];
}

export interface ProviderSettings {
  provider: Provider;
  apiKey: string;
  model: string;
}

export const DEFAULT_PROVIDER_SETTINGS: ProviderSettings = {
  provider: "anthropic",
  apiKey: "",
  model: "claude-sonnet-4-6",
};
