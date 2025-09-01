import { NextRequest, NextResponse } from 'next/server';
import { createSearchIndex, addDocumentsToIndex, searchIndex, chunkText, boostSearchResults, SearchIndex } from '@/lib/bm25';
import { extractTextFromHTML, shouldCrawlUrl, extractLinks, isRelevantContent, ParsedContent } from '@/lib/html';
import { cache, CacheManager } from '@/lib/cache';

const TARGET_DOMAIN = 'https://fahadimdad.com';
const MAX_PAGES = 100;
const CACHE_TTL = {
  SITEMAP: 6 * 60 * 60, // 6 hours
  PAGE: 24 * 60 * 60,   // 24 hours
  SEARCH: 6 * 60 * 60,  // 6 hours
};

export async function POST(request: NextRequest) {
  try {
    const { q: query, max = 8 } = await request.json();
    
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Check cache first
    const cacheKey = CacheManager.getSearchKey(query);
    const cachedResult = await cache.get(cacheKey);
    if (cachedResult) {
      return NextResponse.json(cachedResult);
    }

    // Get or build search index
    const index = await getOrBuildSearchIndex();
    
    // Search the index
    const results = searchIndex(index, query, max);
    const boostedResults = boostSearchResults(results);

    // Format results
    const formattedResults = boostedResults.map(result => ({
      url: result.url,
      title: result.title,
      text: result.text,
      snippet: result.text.substring(0, 200) + '...',
      score: result.score,
    }));

    const response = {
      results: formattedResults,
      sources: formattedResults.map(r => ({
        url: r.url,
        title: r.title,
        snippet: r.snippet,
      })),
      query,
      totalResults: formattedResults.length,
    };

    // Cache the results
    await cache.set(cacheKey, response, CACHE_TTL.SEARCH);

    return NextResponse.json(response);

  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}

async function getOrBuildSearchIndex() {
  // Try to get cached index first
  const indexKey = 'search_index';
  let index = await cache.get<SearchIndex>(indexKey);
  
  if (!index) {
    // Build new index
    index = await buildSearchIndex();
    // Cache the index for 1 hour
    await cache.set(indexKey, index, 3600);
  }
  
  return index;
}

async function buildSearchIndex() {
  console.log('Building search index...');
  
  const index = createSearchIndex();
  const urls = await getUrlsToCrawl();
  const documents = [];

  for (const url of urls) {
    try {
      const content = await fetchAndParsePage(url);
      if (content && isRelevantContent(content)) {
        // Chunk the content for better search
        const chunks = chunkText(content.text, 1000, 200);
        
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          documents.push({
            id: `${url}_chunk_${i}`,
            url,
            title: content.title,
            text: chunk,
          });
        }
      }
    } catch (error) {
      console.error(`Failed to process ${url}:`, error);
    }
  }

  addDocumentsToIndex(index, documents);
  console.log(`Built index with ${documents.length} chunks from ${urls.length} pages`);
  
  return index;
}

async function getUrlsToCrawl(): Promise<string[]> {
  // Try to get sitemap first
  const sitemapUrls = await getSitemapUrls();
  if (sitemapUrls.length > 0) {
    return sitemapUrls.slice(0, MAX_PAGES);
  }

  // Fallback to shallow crawl
  return await shallowCrawl();
}

async function getSitemapUrls(): Promise<string[]> {
  const cacheKey = CacheManager.getSitemapKey();
  const cached = await cache.get<string[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const sitemapUrl = `${TARGET_DOMAIN}/sitemap.xml`;
    const response = await fetch(sitemapUrl, {
      headers: {
        'User-Agent': 'FahadAI/1.0 (Voice Assistant)',
      },
    });

    if (!response.ok) {
      return [];
    }

    const sitemapXml = await response.text();
    const urls: string[] = [];
    
    // Simple XML parsing for URLs
    const urlMatches = sitemapXml.match(/<loc>([^<]+)<\/loc>/g);
    if (urlMatches) {
      for (const match of urlMatches) {
        const url = match.replace(/<\/?loc>/g, '');
        if (url.startsWith(TARGET_DOMAIN)) {
          urls.push(url);
        }
      }
    }

    // Cache the sitemap URLs
    await cache.set(cacheKey, urls, CACHE_TTL.SITEMAP);
    return urls;

  } catch (error) {
    console.error('Failed to fetch sitemap:', error);
    return [];
  }
}

async function shallowCrawl(): Promise<string[]> {
  const urls: string[] = [TARGET_DOMAIN];
  const visited = new Set<string>();
  const toVisit = [TARGET_DOMAIN];

  // Get robots.txt
  const robotsTxt = await getRobotsTxt();

  while (toVisit.length > 0 && urls.length < MAX_PAGES) {
    const currentUrl = toVisit.shift()!;
    
    if (visited.has(currentUrl)) continue;
    visited.add(currentUrl);

    try {
      const content = await fetchAndParsePage(currentUrl);
      if (content) {
        const links = extractLinks(content.text, currentUrl);
        
        for (const link of links) {
          if (!visited.has(link) && 
              shouldCrawlUrl(link, robotsTxt) && 
              urls.length < MAX_PAGES) {
            urls.push(link);
            toVisit.push(link);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to crawl ${currentUrl}:`, error);
    }
  }

  return urls;
}

async function getRobotsTxt(): Promise<string> {
  const cacheKey = CacheManager.getRobotsKey();
  const cached = await cache.get<string>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(`${TARGET_DOMAIN}/robots.txt`);
    const robotsTxt = response.ok ? await response.text() : '';
    await cache.set(cacheKey, robotsTxt, CACHE_TTL.SITEMAP);
    return robotsTxt;
  } catch (error) {
    console.error('Failed to fetch robots.txt:', error);
    return '';
  }
}

async function fetchAndParsePage(url: string) {
  const cacheKey = CacheManager.getPageKey(url);
  const cached = await cache.get<ParsedContent>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'FahadAI/1.0 (Voice Assistant)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const content = extractTextFromHTML(html, url);
    
    // Cache the parsed content
    await cache.set(cacheKey, content, CACHE_TTL.PAGE);
    
    return content;

  } catch (error) {
    console.error(`Failed to fetch ${url}:`, error);
    return null;
  }
}