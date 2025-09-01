import { NextRequest, NextResponse } from 'next/server';
import { extractTextFromHTML } from '@/lib/html';
import { cache, CacheManager } from '@/lib/cache';

const ALLOWED_DOMAIN = 'fahadimdad.com';
const CACHE_TTL = 24 * 60 * 60; // 24 hours

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate URL domain
    let urlObj: URL;
    try {
      urlObj = new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL' },
        { status: 400 }
      );
    }

    if (urlObj.hostname !== ALLOWED_DOMAIN) {
      return NextResponse.json(
        { error: 'Domain not allowed' },
        { status: 403 }
      );
    }

    // Check cache first
    const cacheKey = CacheManager.getPageKey(url);
    const cached = await cache.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Fetch the page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'FahadAI/1.0 (Voice Assistant)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch page: ${response.status}` },
        { status: response.status }
      );
    }

    const html = await response.text();
    const content = extractTextFromHTML(html, url);
    
    // Get ETag and Last-Modified headers for caching
    const etag = response.headers.get('etag');
    const lastModified = response.headers.get('last-modified');
    
    const result = {
      url: content.url,
      title: content.title,
      text: content.text,
      headings: content.headings,
      etag,
      lastModified,
      fetchedAt: new Date().toISOString(),
    };

    // Cache the result
    await cache.set(cacheKey, result, CACHE_TTL);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Preview API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch page' },
      { status: 500 }
    );
  }
}