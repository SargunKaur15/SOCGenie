/* ---------------------------------------------------------------------------
   Anthropic provider — the only real provider, called with global fetch.

   No SDK dependency: one HTTPS POST does not justify a package. The interface
   below is what a second provider would implement, so adding one later does
   not touch the handler.

   The API key is read from config and placed in a header. It is never logged,
   never returned, and never included in an error message.
--------------------------------------------------------------------------- */
import type { ServerConfig } from "./config";
import { systemPromptFor, type PromptIntent } from "./prompt";
/** Reads a response body with a hard byte ceiling.
 *  res.json() is unbounded — a hostile or malfunctioning upstream could stream
 *  until memory is exhausted. */
async function readBounded(res: { text(): Promise<string> }, maxBytes: number): Promise<string | null> {
  const text = await res.text();
  return Buffer.byteLength(text) > maxBytes ? null : text;
}


export type ProviderFailure = "PROVIDER_UNAVAILABLE" | "PROVIDER_TIMEOUT";

export interface ProviderSuccess {
  ok: true;
  text: string;
}
export interface ProviderError {
  ok: false;
  code: ProviderFailure;
  /** Safe to log server-side. Never contains the key or raw provider body. */
  detail: string;
}
export type ProviderResult = ProviderSuccess | ProviderError;

/** Shape any future provider must satisfy. */
export interface LlmProvider {
  readonly name: string;
  /** `intent` selects the per-intent instruction block. Defaults to "general"
   *  so an omitted intent degrades safely instead of reusing analysis rules. */
  complete(userMessage: string, cfg: ServerConfig, intent?: PromptIntent): Promise<ProviderResult>;
}

export const anthropicProvider: LlmProvider = {
  name: "anthropic",

  async complete(userMessage, cfg, intent = "general") {
    if (!cfg.apiKey) {
      return { ok: false, code: "PROVIDER_UNAVAILABLE", detail: "No API key configured." };
    }

    // Single attempt with an abort timeout. No retry loop: repeated calls on a
    // failing provider burn quota and delay the fallback the analyst needs.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.providerTimeoutMs);

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": cfg.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: cfg.model,
          max_tokens: 1500,
          system: systemPromptFor(intent),
          messages: [{ role: "user", content: userMessage }],
        }),
      });

      if (!res.ok) {
        // Status only — the provider body may echo request content.
        return {
          ok: false,
          code: "PROVIDER_UNAVAILABLE",
          detail: `Provider responded ${res.status}.`,
        };
      }

      const raw = await readBounded(res, cfg.maxProviderBytes);
      if (raw === null) {
        return { ok: false, code: "PROVIDER_UNAVAILABLE", detail: "Provider response exceeded the size limit." };
      }
      let data: { content?: { type?: string; text?: string }[] };
      try {
        data = JSON.parse(raw) as typeof data;
      } catch {
        return { ok: false, code: "PROVIDER_UNAVAILABLE", detail: "Provider returned unparseable JSON." };
      }
      const text = (data.content ?? [])
        .filter((b) => b.type === "text" && typeof b.text === "string")
        .map((b) => b.text as string)
        .join("\n")
        .trim();

      if (!text) {
        return { ok: false, code: "PROVIDER_UNAVAILABLE", detail: "Provider returned no text content." };
      }
      return { ok: true, text };
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      return {
        ok: false,
        code: aborted ? "PROVIDER_TIMEOUT" : "PROVIDER_UNAVAILABLE",
        detail: aborted ? `Timed out after ${cfg.providerTimeoutMs}ms.` : "Network or parse failure.",
      };
    } finally {
      clearTimeout(timer);
    }
  },
};
