import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getRoutingChatProvider, providerStatus } from "../lib/ai/provider";
import { probeBackend } from "../lib/ai/backendClient";
import { classifyIntent } from "../lib/ai/chatEngine";
import type { ChatIntent, ChatMessage, SocResponse } from "../lib/ai/chat";
import { useAlerts } from "./useAlerts";
import { useIncidentStore } from "./useIncidents";

/**
 * Conversation state for the AI SOCGenie assistant.
 *
 * Reads the alert and incident stores directly, so context is injected
 * automatically — the analyst never pastes alert data into the chat. No new
 * data source is introduced and no store is mutated.
 */
export function useAiChat(focusAlertRef?: string | null) {
  const { alerts } = useAlerts();
  const { incidents } = useIncidentStore();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Probe once on mount so the header status is accurate before the first ask.
  useEffect(() => {
    void probeBackend();
  }, []);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const context = useMemo(
    () => ({ alerts, incidents, focusAlertRef: focusAlertRef ?? null }),
    [alerts, incidents, focusAlertRef]
  );

  const stamp = () => new Date().toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit" });

  const send = useCallback(
    async (text: string, forcedIntent?: ChatIntent) => {
      const question = text.trim();
      if (!question || thinking) return;

      seq.current += 1;
      const userMessage: ChatMessage = {
        id: `m-${seq.current}`,
        role: "user",
        text: question,
        createdAt: stamp(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setThinking(true);
      setError(null);

      try {
        const intent = forcedIntent ?? classifyIntent(question);
        const response: SocResponse = await getRoutingChatProvider().respond(question, intent, context);
        seq.current += 1;
        setMessages((prev) => [
          ...prev,
          { id: `m-${seq.current}`, role: "assistant", response, createdAt: stamp() },
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "The assistant could not complete that request.");
      } finally {
        setThinking(false);
      }
    },
    [context, thinking]
  );

  const clear = useCallback(() => {
    setMessages([]);
    setError(null);
    seq.current = 0;
  }, []);

  return {
    messages,
    thinking,
    error,
    send,
    clear,
    providerLabel: providerStatus().label,
    alertCount: alerts.length,
    incidentCount: incidents.length,
  };
}
