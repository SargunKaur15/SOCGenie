/* ---------------------------------------------------------------------------
   Provider registry.

   One lookup, so handler.ts never names a concrete provider. Adding a third
   provider means implementing LlmProvider and adding one entry here — no
   change to the pipeline, the guard, or the frontend.
--------------------------------------------------------------------------- */
import type { ServerConfig, ProviderName } from "./config";
import { anthropicProvider, type LlmProvider } from "./anthropicProvider";
import { openRouterProvider } from "./openRouterProvider";

const REGISTRY: Record<Exclude<ProviderName, "none">, LlmProvider> = {
  anthropic: anthropicProvider,
  openrouter: openRouterProvider,
};

/** Null when no provider is configured — the caller then falls back. */
export function selectProvider(cfg: ServerConfig): LlmProvider | null {
  if (cfg.provider === "none") return null;
  return REGISTRY[cfg.provider] ?? null;
}

export const AVAILABLE_PROVIDERS = Object.keys(REGISTRY);
