declare module 'wink-bm25-text-search' {
  export interface BM25Options {
    k1?: number;
    b?: number;
  }

  export interface SearchResult {
    id: string;
    score: number;
  }

  export class BM25 {
    constructor(options?: BM25Options);
    addDoc(doc: { id: string; text: string }): void;
    search(query: string, maxResults?: number): SearchResult[];
    getStats(): { totalDocs: number; totalTerms: number };
  }
}