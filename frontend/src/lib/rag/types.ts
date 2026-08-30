/* ---------------------------------------------------------------------------
   RAG layer contracts — Phase 8.

   Retrieval-Augmented Generation supplies a model with retrieved context at
   query time. It does NOT train or fine-tune anything: the knowledge base is
   read, never learned from. Nothing in this layer modifies any model.

   Phase 8 implements deterministic lexical retrieval over a curated local
   corpus. No embeddings, no vector database, no network. The interfaces are
   shaped so a vector store can replace the ranking function later without
   changing any caller.
--------------------------------------------------------------------------- */

/** Where a document came from. Displayed verbatim as the citation source. */
export type KnowledgeSource =
  | "MITRE ATT&CK"
  | "SOCGenie Knowledge Base"
  | "SOC Procedure";

export type KnowledgeCategory =
  | "technique"
  | "investigation"
  | "triage"
  | "evidence"
  | "false-positive"
  | "containment"
  | "escalation";

export interface KnowledgeDocument {
  id: string;
  title: string;
  source: KnowledgeSource;
  category: KnowledgeCategory;
  content: string;
  tags: string[];
  /** ATT&CK IDs this document speaks to. Curated — never inferred. */
  techniqueIds: string[];
  /** Present only where the guidance is severity-specific. */
  severity: "critical" | "high" | "medium" | "low" | null;
  updatedAt: string;
  /** Only set when a genuine public URL exists. Never fabricated. */
  url: string | null;
}

export interface RetrievedChunk {
  documentId: string;
  title: string;
  content: string;
  source: KnowledgeSource;
  category: KnowledgeCategory;
  /** 0-1. Deterministic lexical score, not a semantic similarity. */
  relevanceScore: number;
  metadata: {
    techniqueIds: string[];
    tags: string[];
    updatedAt: string;
    url: string | null;
    /** Which signals contributed, so a score can be explained. */
    matchedOn: string[];
  };
}

export interface RetrievalQuery {
  text: string;
  /** ATT&CK IDs from the alert in scope. Weighted heavily — an exact technique
   *  match is the strongest signal available without embeddings. */
  techniqueIds?: string[];
  categories?: KnowledgeCategory[];
  topK?: number;
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  /** True when nothing cleared the relevance floor. Callers must then say so
   *  rather than answering from nothing. */
  insufficient: boolean;
  /** Free-text explanation of what was searched, for transparency. */
  searchedOver: string;
}

/** The exact string the UI shows when retrieval finds nothing usable. */
export const INSUFFICIENT_EVIDENCE = "Insufficient evidence in the current knowledge base.";
