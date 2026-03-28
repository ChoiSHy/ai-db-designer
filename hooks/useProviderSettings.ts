"use client";

import { useState, useCallback, useEffect } from "react";
import { ProviderSettings, DEFAULT_PROVIDER_SETTINGS, PROVIDERS } from "@/lib/providers";

const LS_KEY = "db-designer:provider-settings";

function load(): ProviderSettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_PROVIDER_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<ProviderSettings>;
    // provider가 유효한지 확인
    const validProvider = PROVIDERS.find((p) => p.id === parsed.provider);
    if (!validProvider) return DEFAULT_PROVIDER_SETTINGS;
    // model이 해당 provider에 속하는지 확인
    const validModel = validProvider.models.find((m) => m.id === parsed.model);
    return {
      provider: validProvider.id,
      apiKey: parsed.apiKey ?? "",
      model: validModel?.id ?? validProvider.models[0].id,
    };
  } catch {
    return DEFAULT_PROVIDER_SETTINGS;
  }
}

export function useProviderSettings() {
  const [settings, setSettings] = useState<ProviderSettings>(DEFAULT_PROVIDER_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSettings(load());
    setHydrated(true);
  }, []);

  const updateSettings = useCallback((next: ProviderSettings) => {
    setSettings(next);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  }, []);

  return { settings, updateSettings, hydrated };
}
