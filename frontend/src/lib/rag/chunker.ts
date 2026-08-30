/* ---------------------------------------------------------------------------
   Chunking.

   Documents here are already short and single-topic, so Phase 8 returns whole
   documents and truncates only for display. The seam exists so that longer
   corpora can be split without changing the retriever or its callers.
--------------------------------------------------------------------------- */
import type { KnowledgeDocument } from "./types";

/** Characters of content carried into a retrieved chunk. */
export const CHUNK_LIMIT = 600;

export function chunkDocument(doc: KnowledgeDocument): string[] {
  if (doc.content.length <= CHUNK_LIMIT) return [doc.content];

  // Split on sentence boundaries so a chunk never ends mid-clause.
  const sentences = doc.content.match(/[^.!?]+[.!?]+\s*/g) ?? [doc.content];
  const chunks: string[] = [];
  let current = "";
  for (const s of sentences) {
    if ((current + s).length > CHUNK_LIMIT && current) {
      chunks.push(current.trim());
      current = "";
    }
    current += s;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/** Shortens for citation display without cutting a word in half. */
export function excerpt(content: string, limit = 240): string {
  if (content.length <= limit) return content;
  const cut = content.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : limit)}…`;
}
