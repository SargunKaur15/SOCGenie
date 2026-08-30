/* ---------------------------------------------------------------------------
   Deterministic relevance scoring.

   Lexical, not semantic — the same query always yields the same ordering, and
   every score can be explained by the signals that produced it. That
   explainability is why this is preferable to embeddings for a defensive tool
   at this stage: an analyst can see WHY a document was retrieved.

   Weights, highest first:
     exact ATT&CK ID match   0.50   strongest available signal
     tag match               0.18   curated, so precise
     title term match        0.12
     content term match      0.06   capped, so long documents cannot dominate
     category request match  0.08
--------------------------------------------------------------------------- */
import type { KnowledgeDocument, RetrievalQuery } from "./types";

const STOP = new Set([
  "the","a","an","is","are","was","were","this","that","these","those","of","to",
  "in","on","for","and","or","it","its","with","from","by","as","at","be","been",
  "what","which","how","why","when","who","should","could","would","can","do",
  "does","did","i","we","you","my","me","us","about","tell","show","explain",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9.\-\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

/** Pulls ATT&CK identifiers out of free text, e.g. "explain T1059.001". */
export function extractTechniqueIds(text: string): string[] {
  return [...new Set((text.toUpperCase().match(/T\d{4}(?:\.\d{3})?/g) ?? []))];
}

export interface ScoreResult {
  score: number;
  matchedOn: string[];
}

export function scoreDocument(doc: KnowledgeDocument, query: RetrievalQuery): ScoreResult {
  const terms = tokenize(query.text);
  const queryTechniques = [
    ...new Set([...(query.techniqueIds ?? []), ...extractTechniqueIds(query.text)]),
  ];

  let score = 0;
  const matchedOn: string[] = [];

  // Exact technique match — decisive when present.
  const techHits = doc.techniqueIds.filter((t) => queryTechniques.includes(t));
  if (techHits.length > 0) {
    score += 0.5;
    matchedOn.push(`technique ${techHits.join(", ")}`);
  }

  const tagHits = doc.tags.filter((tag) =>
    terms.some((t) => tag.includes(t) || t.includes(tag))
  );
  if (tagHits.length > 0) {
    score += Math.min(0.18, 0.09 * tagHits.length);
    matchedOn.push(`tags: ${tagHits.slice(0, 3).join(", ")}`);
  }

  const titleLower = doc.title.toLowerCase();
  const titleHits = terms.filter((t) => titleLower.includes(t));
  if (titleHits.length > 0) {
    score += Math.min(0.12, 0.06 * titleHits.length);
    matchedOn.push("title");
  }

  const contentLower = doc.content.toLowerCase();
  const contentHits = terms.filter((t) => contentLower.includes(t));
  if (contentHits.length > 0) {
    // Capped so a long document cannot outrank a precise technique match.
    score += Math.min(0.06, 0.015 * contentHits.length);
    matchedOn.push("content");
  }

  if (query.categories?.includes(doc.category)) {
    score += 0.08;
    matchedOn.push(`category ${doc.category}`);
  }

  return { score: Math.min(1, Number(score.toFixed(4))), matchedOn };
}

/** Below this a document is treated as noise rather than evidence. */
export const RELEVANCE_FLOOR = 0.1;
