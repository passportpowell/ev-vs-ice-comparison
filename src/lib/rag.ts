import type {
  PortfolioDataset,
  RagDocument,
  RagHit,
  RagIndex,
} from "@/lib/types";

// Lexical-stage stop words. The semantic stage uses the IDF table baked by
// scikit-learn during the pipeline (see build_rag_index in build.py).
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "best",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "to",
  "vs",
  "what",
  "which",
  "with",
]);

const SYNONYMS: Record<string, string> = {
  carbon: "co2e",
  charging: "charge",
  cheapest: "cost",
  cheap: "cost",
  cleaner: "emissions",
  cleanest: "emissions",
  electric: "ev",
  electricity: "ev",
  emission: "emissions",
  ice: "petrol",
  mileage: "miles",
};

export function retrieveDocuments(
  data: PortfolioDataset,
  query: string,
  limit = 5
): RagHit[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) {
    return [];
  }

  const index = data.rag_index;
  if (index && Object.keys(index.vocab).length > 0) {
    return semanticRetrieve(data, tokens, index, limit);
  }

  return lexicalRetrieve(data, tokens, limit);
}

export function buildRagAnswer(query: string, hits: RagHit[]): string {
  if (hits.length === 0) {
    return "I could not find a grounded match in the project knowledge base.";
  }

  const top = hits[0];
  const support = hits
    .slice(1, 3)
    .map((hit) => hit.title)
    .join(", ");
  const supportText = support ? ` Supporting context: ${support}.` : "";
  const relatedText = top.related?.length
    ? ` Semantically related: ${top.related.map((r) => r.title).join(", ")}.`
    : "";

  return `For "${query}", the strongest retrieved source is "${top.title}". ${top.content}${supportText}${relatedText}`;
}

function semanticRetrieve(
  data: PortfolioDataset,
  tokens: string[],
  index: RagIndex,
  limit: number
): RagHit[] {
  const queryVector = buildQueryVector(tokens, index);
  if (queryVector.size === 0) {
    return lexicalRetrieve(data, tokens, limit);
  }

  const scored = data.rag_corpus.map((document) => {
    const docVector = parseDocVector(document.tfidf_vector);
    const score = cosineSimilarity(queryVector, docVector);
    const matchedTerms = collectMatchedTerms(tokens, document);
    return { document, score, matchedTerms };
  });

  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ document, score, matchedTerms }) => ({
      ...document,
      score: Number(score.toFixed(4)),
      matched_terms: matchedTerms,
      related: resolveNeighbours(data, document),
    }));
}

function lexicalRetrieve(
  data: PortfolioDataset,
  tokens: string[],
  limit: number
): RagHit[] {
  const scored = data.rag_corpus.map((document) =>
    fallbackScore(document, tokens)
  );
  return scored
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function buildQueryVector(
  tokens: string[],
  index: RagIndex
): Map<number, number> {
  // Build a TF (sublinear like scikit-learn) * IDF query vector.
  const tf = new Map<number, number>();
  const tfRaw = new Map<number, number>();

  for (const token of tokens) {
    const entry = index.vocab[token];
    if (!entry) continue;
    tfRaw.set(entry.i, (tfRaw.get(entry.i) ?? 0) + 1);
  }

  // Bigrams to align with the pipeline's ngram_range = (1, 2).
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const bigram = `${tokens[i]} ${tokens[i + 1]}`;
    const entry = index.vocab[bigram];
    if (!entry) continue;
    tfRaw.set(entry.i, (tfRaw.get(entry.i) ?? 0) + 1);
  }

  let norm = 0;
  for (const [idx, count] of tfRaw) {
    const sublinearTf = 1 + Math.log(count);
    const idf = index.vocab[lookupTerm(index, idx)]?.idf ?? 1;
    const weight = sublinearTf * idf;
    tf.set(idx, weight);
    norm += weight * weight;
  }
  norm = Math.sqrt(norm) || 1;
  for (const [idx, weight] of tf) {
    tf.set(idx, weight / norm);
  }
  return tf;
}

function lookupTerm(index: RagIndex, vocabIndex: number): string {
  // Reverse lookup is rare and small; cache once.
  cachedReverseVocab ??= buildReverseVocab(index);
  return cachedReverseVocab.get(vocabIndex) ?? "";
}

let cachedReverseVocab: Map<number, string> | null = null;

function buildReverseVocab(index: RagIndex): Map<number, string> {
  const map = new Map<number, string>();
  for (const [term, info] of Object.entries(index.vocab)) {
    map.set(info.i, term);
  }
  return map;
}

function parseDocVector(
  vector: Record<string, number> | undefined
): Map<number, number> {
  const result = new Map<number, number>();
  if (!vector) return result;
  for (const [key, weight] of Object.entries(vector)) {
    result.set(Number(key), weight);
  }
  return result;
}

function cosineSimilarity(
  a: Map<number, number>,
  b: Map<number, number>
): number {
  // Both vectors are L2-normalised at construction time, so cosine = dot.
  if (a.size === 0 || b.size === 0) return 0;
  const [smaller, larger] = a.size < b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [idx, weight] of smaller) {
    const other = larger.get(idx);
    if (other !== undefined) {
      dot += weight * other;
    }
  }
  return dot;
}

function collectMatchedTerms(tokens: string[], document: RagDocument): string[] {
  const haystack = `${document.title} ${(document.tags ?? []).join(" ")} ${document.content}`.toLowerCase();
  return Array.from(
    new Set(tokens.filter((term) => haystack.includes(term)))
  );
}

function resolveNeighbours(
  data: PortfolioDataset,
  document: RagDocument
): RagHit["related"] {
  if (!document.semantic_neighbours?.length) return [];
  const byId = new Map(data.rag_corpus.map((doc) => [doc.id, doc]));
  return document.semantic_neighbours
    .map((neighbour) => {
      const target = byId.get(neighbour.id);
      if (!target) return null;
      return {
        id: target.id,
        title: target.title,
        similarity: Number(neighbour.similarity.toFixed(3)),
      };
    })
    .filter((item): item is { id: string; title: string; similarity: number } => Boolean(item));
}

function fallbackScore(document: RagDocument, terms: string[]): RagHit {
  const titleTokens = tokenize(document.title);
  const tagTokens = (document.tags ?? []).flatMap(tokenize);
  const contentTokens = tokenize(document.content);
  const allTokens = [...titleTokens, ...tagTokens, ...contentTokens];
  const matchedTerms = Array.from(
    new Set(terms.filter((term) => allTokens.includes(term)))
  );

  let score = 0;
  for (const term of terms) {
    score += titleTokens.filter((t) => t === term).length * 4;
    score += tagTokens.filter((t) => t === term).length * 3;
    score += contentTokens.filter((t) => t === term).length;
  }
  const normalized = score / Math.sqrt(Math.max(allTokens.length, 1));

  return {
    ...document,
    score: Number(normalized.toFixed(3)),
    matched_terms: matchedTerms,
  };
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .map((term) => normalizeTerm(term.trim()))
    .filter((term) => term.length > 1 && !STOP_WORDS.has(term));
}

function normalizeTerm(term: string): string {
  return SYNONYMS[term] ?? term;
}
