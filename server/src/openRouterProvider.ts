/* ---------------------------------------------------------------------------
   OpenRouter provider.

   OpenRouter exposes an OpenAI-compatible chat-completions endpoint, so one
   HTTPS POST covers it — no SDK dependency, matching the Anthropic provider.

   FREE-TIER CAVEAT: which models carry a ":free" suffix changes over time, and
   free models are markedly weaker at producing strict JSON than paid ones.
   That weakness is survivable here: unparseable output is caught by
   parseModelJson() and falls back to the deterministic engine rather than
   reaching an analyst. Set LLM_MODEL to change model without a code change.

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

import type { LlmProvider, ProviderResult } from "./anthropicProvider";

export const openRouterProvider: LlmProvider = {
  name: "openrouter",

  async complete(userMessage, cfg: ServerConfig, intent: PromptIntent = "general"): Promise<ProviderResult> {
    if (!cfg.apiKey) {
      return { ok: false, code: "PROVIDER_UNAVAILABLE", detail: "No API key configured." };
    }

    // Single attempt with an abort timeout. No retry loop: repeated calls on a
    // failing provider delay the fallback the analyst actually needs, and free
    // tiers rate-limit aggressively.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.providerTimeoutMs);

    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${cfg.apiKey}`,
          // Optional attribution headers OpenRouter uses for its dashboard.
          // Neither carries a credential.
          "HTTP-Referer": "http://localhost:5173",
          "X-Title": "SOCGenie",
        },
        body: JSON.stringify({
          model: cfg.model,
          max_tokens: 1500,
          temperature: 0,
          messages: [
            { role: "system", content: systemPromptFor(intent) },
            { role: "user", content: userMessage },
          ],
        }),
      });

      if (!res.ok) {
        // Status only. The provider body can echo request content, and on a
        // free tier it can also contain routing metadata we should not log.
        return {
          ok: false,
          code: "PROVIDER_UNAVAILABLE",
          detail:
            res.status === 404
              ? `Model "${cfg.model}" not found — free model availability changes; set LLM_MODEL.`
              : `Provider responded ${res.status}.`,
        };
      }

      const raw = await readBounded(res, cfg.maxProviderBytes);
      if (raw === null) {
        return { ok: false, code: "PROVIDER_UNAVAILABLE", detail: "Provider response exceeded the size limit." };
      }
      let data: {
        choices?: {
          message?: { content?: unknown; reasoning?: unknown };
          finish_reason?: unknown;
        }[];
        error?: { message?: unknown };
      };
      try {
        data = JSON.parse(raw) as typeof data;
      } catch {
        return { ok: false, code: "PROVIDER_UNAVAILABLE", detail: "Provider returned unparseable JSON." };
      }

      // OpenRouter can return HTTP 200 with an error body when a free model is
      // saturated, so success is not implied by the status code alone.
      if (data.error) {
        return { ok: false, code: "PROVIDER_UNAVAILABLE", detail: "Provider returned an error body." };
      }

      const choice = data.choices?.[0];
      const content = choice?.message?.content;
      let text = typeof content === "string" ? content.trim() : "";

      // Reasoning models (deepseek-r1 and similar) return their output in
      // `message.reasoning` and leave `content` EMPTY. Reading only `content`
      // makes such a model look like a dead provider, which is indistinguishable
      // from a quota failure in the logs.
      if (!text) {
        const reasoning = choice?.message?.reasoning;
        if (typeof reasoning === "string" && reasoning.trim()) {
          text = reasoning.trim();
        }
      }

      if (!text) {
        // Report WHY. "no text content" alone cannot distinguish an empty
        // choices array from a refusal from a truncated completion, which is
        // what made this failure hard to diagnose.
        const finish = typeof choice?.finish_reason === "string" ? choice.finish_reason : "unknown";
        const detail =
          data.choices === undefined
            ? "Provider response contained no `choices` field."
            : data.choices.length === 0
              ? "Provider returned an empty `choices` array (model declined or is saturated)."
              : `Provider returned an empty completion (finish_reason=${finish}). ` +
                `If finish_reason is "length", raise max_tokens; if the model is a reasoning model, ` +
                `its output may be in an unsupported field.`;
        return { ok: false, code: "PROVIDER_UNAVAILABLE", detail };
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
