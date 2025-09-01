import { BM25 } from 'wink-bm25-text-search';

export interface SearchResult {
  id: string;
  url: string;
  title?: string;
  text: string;
  score: number;
}

export interface SearchIndex {
  bm25: BM25;
  documents: Map<string, SearchResult>;
}

// Create a new search index
export function createSearchIndex(): SearchIndex {
  const bm25 = new BM25();
  const documents = new Map<string, SearchResult>();
  
  return { bm25, documents };
}

// Add documents to the search index
export function addDocumentsToIndex(
  index: SearchIndex, 
  documents: Array<{
    id: string;
    url: string;
    title?: string;
    text: string;
  }>
): void {
  for (const doc of documents) {
    // Prepare text for indexing (combine title and content)
    const searchableText = [doc.title, doc.text].filter(Boolean).join(' ');
    
    // Add to BM25 index
    index.bm25.addDoc({
      id: doc.id,
      text: searchableText,
    });
    
    // Store full document
    index.documents.set(doc.id, {
      id: doc.id,
      url: doc.url,
      title: doc.title,
      text: doc.text,
      score: 0,
    });
  }
}

// Search the index
export function searchIndex(
  index: SearchIndex, 
  query: string, 
  maxResults: number = 8
): SearchResult[] {
  if (!query.trim()) return [];
  
  try {
    const results = index.bm25.search(query, maxResults);
    
    return results.map(result => {
      const doc = index.documents.get(result.id);
      if (!doc) return null;
      
      return {
        ...doc,
        score: result.score,
      };
    }).filter(Boolean) as SearchResult[];
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

// Chunk text into smaller pieces for better search
export function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  if (text.length <= chunkSize) return [text];
  
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    let end = start + chunkSize;
    
    // Try to break at sentence boundaries
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('.', end);
      const lastExclamation = text.lastIndexOf('!', end);
      const lastQuestion = text.lastIndexOf('?', end);
      
      const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion);
      
      if (lastSentenceEnd > start + chunkSize * 0.5) {
        end = lastSentenceEnd + 1;
      }
    }
    
    chunks.push(text.slice(start, end).trim());
    start = end - overlap;
  }
  
  return chunks.filter(chunk => chunk.length > 50);
}

// Extract keywords from text for better search
export function extractKeywords(text: string): string[] {
  // Simple keyword extraction - remove common words and extract meaningful terms
  const commonWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'
  ]);
  
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !commonWords.has(word))
    .slice(0, 10); // Limit to top 10 keywords
}

// Boost search results based on content type
export function boostSearchResults(results: SearchResult[]): SearchResult[] {
  return results.map(result => {
    let boost = 1.0;
    
    // Boost if title matches query
    if (result.title) {
      const titleWords = result.title.toLowerCase().split(/\s+/);
      const queryWords = result.text.toLowerCase().split(/\s+/);
      const titleMatches = titleWords.filter(word => queryWords.includes(word)).length;
      boost += titleMatches * 0.5;
    }
    
    // Boost if URL path is relevant
    const urlPath = new URL(result.url).pathname.toLowerCase();
    if (urlPath.includes('about') || urlPath.includes('bio')) {
      boost += 0.3;
    }
    
    return {
      ...result,
      score: result.score * boost,
    };
  }).sort((a, b) => b.score - a.score);
}