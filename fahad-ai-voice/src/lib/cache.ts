import { kv } from '@vercel/kv';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// In-memory cache fallback
const memoryCache = new Map<string, CacheEntry<unknown>>();

export class CacheManager {
  private useKV: boolean;
  private memoryTTL: number;

  constructor() {
    this.useKV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
    this.memoryTTL = 300000; // 5 minutes for memory cache
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      if (this.useKV) {
        const entry = await kv.get<CacheEntry<T>>(key);
        if (entry && this.isValid(entry)) {
          return entry.data;
        }
        return null;
      } else {
        const entry = memoryCache.get(key) as CacheEntry<T> | undefined;
        if (entry && this.isValid(entry)) {
          return entry.data;
        }
        memoryCache.delete(key);
        return null;
      }
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set<T>(key: string, data: T, ttlSeconds: number = 3600): Promise<void> {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl: ttlSeconds * 1000,
      };

      if (this.useKV) {
        await kv.setex(key, ttlSeconds, entry);
      } else {
        memoryCache.set(key, entry);
        // Clean up expired entries periodically
        this.cleanupMemoryCache();
      }
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      if (this.useKV) {
        await kv.del(key);
      } else {
        memoryCache.delete(key);
      }
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  private isValid<T>(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }

  private cleanupMemoryCache(): void {
    const now = Date.now();
    for (const [key, entry] of memoryCache.entries()) {
      if (now - entry.timestamp >= entry.ttl) {
        memoryCache.delete(key);
      }
    }
  }

  // Cache key generators
  static getSitemapKey(): string {
    return 'sitemap:fahadimdad.com';
  }

  static getPageKey(url: string): string {
    return `page:${url}`;
  }

  static getSearchKey(query: string): string {
    return `search:${query.toLowerCase().replace(/\s+/g, '_')}`;
  }

  static getRobotsKey(): string {
    return 'robots:fahadimdad.com';
  }
}

// Singleton instance
export const cache = new CacheManager();