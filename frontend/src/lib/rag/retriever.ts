/* ---------------------------------------------------------------------------
   Deterministic retriever.

   Reads the local corpus only. No network, no embeddings, no vector store.
   When nothing clears the relevance floor the result is marked insufficient so
   callers can say so plainly instead of answering from nothing.
--------------------------------------------------------------------------- */
import { KNOWLEDGE_BASE } from "./knowledgeBase";
import { RELEVANCE_FLOOR, scoreDocument } from "./ranking";
import { chunkDocument, excerpt } from "./chunker";
import type { RetrievalQuery, RetrievalResult, RetrievedChunk } from "./types";

const DEFAULT_TOP_K = 4;

export function retrieve(query: RetrievalQuery): RetrievalResult {
  const topK = query.topK ?? DEFAULT_TOP_K;

  const scored = KNOWLEDGE_BASE.map((doc) => ({ doc, ...scoreDocument(doc, query) }))
    .filter((s) => s.score >= RELEVANCE_FLOOR)
    // Deterministic tie-break on id so ordering is stable across runs.
    .sort((a, b) => b.score - a.score || a.doc.id.localeCompare(b.doc.id));

  // One chunk per document — deduplicates by construction.
  const chunks: RetrievedChunk[] = scored.slice(0, topK).map((s) => ({
    documentId: s.doc.id,
    title: s.doc.title,
    content: chunkDocument(s.doc)[0],
    source: s.doc.source,
    category: s.doc.category,
    relevanceScore: s.score,
    metadata: {
      techniqueIds: s.doc.techniqueIds,
      tags: s.doc.tags,
      updatedAt: s.doc.updatedAt,
      url: s.doc.url,
      matchedOn: s.matchedOn,
    },
  }));

  return {
    chunks,
    insufficient: chunks.length === 0,
    searchedOver: `${KNOWLEDGE_BASE.length} curated documents (local knowledge base, no live feed)`,
  };
}

export { excerpt };
