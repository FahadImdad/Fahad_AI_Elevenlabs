export interface ParsedContent {
  title?: string;
  text: string;
  headings: string[];
  url: string;
}

// Clean HTML and extract text content
export function extractTextFromHTML(html: string, url: string): ParsedContent {
  // Create a temporary DOM parser (works in Node.js with jsdom or similar)
  // For now, we'll use regex-based extraction which is simpler for serverless
  
  // Remove script and style elements
  const cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '');

  // Extract title
  const titleMatch = cleanHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? cleanHtmlToText(titleMatch[1]) : undefined;

  // Extract headings
  const headings: string[] = [];
  const headingRegex = /<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi;
  let headingMatch;
  while ((headingMatch = headingRegex.exec(cleanHtml)) !== null) {
    const headingText = cleanHtmlToText(headingMatch[1]);
    if (headingText.trim()) {
      headings.push(headingText);
    }
  }

  // Extract main content (prefer main, article, or content areas)
  let mainContent = '';
  
  // Try to find main content areas first
  const mainMatch = cleanHtml.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  const articleMatch = cleanHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const contentMatch = cleanHtml.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  
  if (mainMatch) {
    mainContent = mainMatch[1];
  } else if (articleMatch) {
    mainContent = articleMatch[1];
  } else if (contentMatch) {
    mainContent = contentMatch[1];
  } else {
    // Fallback to body content
    const bodyMatch = cleanHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    mainContent = bodyMatch ? bodyMatch[1] : cleanHtml;
  }

  // Convert HTML to text
  const text = cleanHtmlToText(mainContent);

  return {
    title,
    text,
    headings,
    url,
  };
}

// Convert HTML to clean text
function cleanHtmlToText(html: string): string {
  return html
    // Remove HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Decode HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    // Clean up whitespace
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

// Extract meta description
export function extractMetaDescription(html: string): string | undefined {
  const metaMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
  return metaMatch ? cleanHtmlToText(metaMatch[1]) : undefined;
}

// Check if URL should be crawled (respect robots.txt rules)
export function shouldCrawlUrl(url: string, robotsTxt: string): boolean {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    
    // Simple robots.txt parsing (basic implementation)
    const lines = robotsTxt.split('\n');
    let userAgent = '';
    const disallowPaths: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('User-agent:')) {
        userAgent = trimmed.substring(11).trim();
      } else if (trimmed.startsWith('Disallow:') && (userAgent === '*' || userAgent === 'FahadAI')) {
        const disallowPath = trimmed.substring(9).trim();
        if (disallowPath) {
          disallowPaths.push(disallowPath);
        }
      }
    }
    
    // Check if current path is disallowed
    for (const disallowPath of disallowPaths) {
      if (path.startsWith(disallowPath)) {
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error checking robots.txt:', error);
    return true; // Default to allowing crawl if there's an error
  }
}

// Extract links from HTML
export function extractLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const linkRegex = /<a[^>]*href="([^"]+)"/gi;
  let match;
  
  while ((match = linkRegex.exec(html)) !== null) {
    try {
      const href = match[1];
      const absoluteUrl = new URL(href, baseUrl).href;
      
      // Only include links from the same domain
      if (new URL(absoluteUrl).hostname === new URL(baseUrl).hostname) {
        links.push(absoluteUrl);
      }
    } catch {
      // Skip invalid URLs
      continue;
    }
  }
  
  return [...new Set(links)]; // Remove duplicates
}

// Check if content is likely to be relevant
export function isRelevantContent(content: ParsedContent): boolean {
  const text = content.text.toLowerCase();
  const title = content.title?.toLowerCase() || '';
  
  // Skip if too short
  if (text.length < 100) return false;
  
  // Skip common non-content pages
  const skipPatterns = [
    '404', 'not found', 'error', 'login', 'sign up', 'register',
    'privacy policy', 'terms of service', 'cookie policy',
    'sitemap', 'rss', 'feed', 'api', 'admin'
  ];
  
  for (const pattern of skipPatterns) {
    if (title.includes(pattern) || text.includes(pattern)) {
      return false;
    }
  }
  
  return true;
}