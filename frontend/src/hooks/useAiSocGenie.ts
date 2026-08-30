import { useCallback, useState, useSyncExternalStore } from "react";
import { getProvider } from "../lib/ai/provider";
import type {
  AIDashboardAnalysis, AIInvestigationAnalysis, DashboardContext,
  DashboardIntent, InvestigationContext,
} from "../lib/ai/types";
import { decisionStore } from "../mocks/decisionStore";

/** Named stages surfaced during analysis. Not internal reasoning — just the
 *  pipeline steps, so the wait is legible rather than opaque. */
export const ANALYSIS_STAGES = [
  "Collecting alert context",
  "Collecting evidence",
  "Correlating activity",
  "Analysing indicators",
  "Evaluating FP/TP indicators",
  "Mapping MITRE ATT&CK",
  "Building timeline",
  "Reconstructing attack story",
  "Calculating risk",
  "Preparing investigation plan",
  "Generating report",
] as const;

export type AiState<T> =
  | { status: "idle" }
  | { status: "running"; stage: number }
  | { status: "ready"; result: T }
  | { status: "error"; message: string };

export function useInvestigationAi() {
  const [state, setState] = useState<AiState<AIInvestigationAnalysis>>({ status: "idle" });

  const analyze = useCallback(async (context: InvestigationContext) => {
    setState({ status: "running", stage: 0 });
    let stage = 0;
    const ticker = window.setInterval(() => {
      stage = Math.min(stage + 1, ANALYSIS_STAGES.length - 1);
      setState({ status: "running", stage });
    }, 90);

    try {
      const result = await getProvider().analyzeInvestigation(context);
      window.clearInterval(ticker);
      setState({ status: "ready", result });
    } catch (error) {
      window.clearInterval(ticker);
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Analysis could not be completed.",
      });
    }
  }, []);

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, analyze, reset };
}

export function useDashboardAi() {
  const [state, setState] = useState<AiState<AIDashboardAnalysis>>({ status: "idle" });

  const ask = useCallback(
    async (context: DashboardContext, intent: DashboardIntent, question?: string) => {
      setState({ status: "running", stage: 0 });
      try {
        const result = await getProvider().analyzeDashboard(context, intent, question);
        setState({ status: "ready", result });
      } catch (error) {
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Analysis could not be completed.",
        });
      }
    },
    []
  );

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, ask, reset };
}

export function useAnalystDecisions(alertRef: string | null) {
  const all = useSyncExternalStore(
    decisionStore.subscribe,
    decisionStore.getSnapshot,
    decisionStore.getSnapshot
  );
  const forAlert = alertRef ? all.filter((r) => r.alertRef === alertRef) : [];
  return { all, forAlert, record: decisionStore.record, stats: decisionStore.agreementStats() };
}
