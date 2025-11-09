import { Injectable, Logger } from '@nestjs/common';
import { YtsService } from '../yts/yts.service';

export interface SearchResult {
  imdb_id: string;
  title: string;
  year: number;
  synopsis?: string;
  runtime?: number;
  genres?: string[];
  image?: string;
  rating?: number;
  trailer?: string;
  torrents: Array<{
    resolution: string;
    quality: string;
    size: string;
    seeds: number;
    peers: number;
    magnet: string;
  }>;
  api?: string;
  source?: string;
}

export interface SearchStats {
  totalResults: number;
  cacheHit: boolean;
  responseTime: number;
  sources: string[];
}

@Injectable()
export class OptimizedSearchService {
  private readonly logger = new Logger(OptimizedSearchService.name);
  private readonly cache = new Map<string, { data: SearchResult[]; timestamp: number }>();
  private readonly CACHE_TTL = 3600 * 1000; // 1 hour cache in milliseconds

  constructor(private readonly ytsService: YtsService) {}

  /**
   * Generate cache key for search query
   */
  private getCacheKey(keywords: string, page: number): string {
    return `search:${keywords.toLowerCase().trim()}:${page}`;
  }

  /**
   * Search with caching and debouncing
   */
  async search(keywords: string, page = 1): Promise<{ data: SearchResult[]; stats: SearchStats }> {
    const startTime = Date.now();
    const cacheKey = this.getCacheKey(keywords, page);

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      const data = cached.data;
      const responseTime = Date.now() - startTime;
      this.logger.log(`Cache HIT for "${keywords}" (${responseTime}ms)`);

      return {
        data,
        stats: {
          totalResults: data.length,
          cacheHit: true,
          responseTime,
          sources: [...new Set(data.map((r: SearchResult) => r.api || 'unknown') as string[])],
        },
      };
    }

    // Search from multiple sources in parallel
    this.logger.log(`Cache MISS for "${keywords}", fetching from APIs...`);

    const results = await this.parallelSearch(keywords, page);
    const responseTime = Date.now() - startTime;

    // Cache the results
    this.cache.set(cacheKey, { data: results, timestamp: Date.now() });

    return {
      data: results,
      stats: {
        totalResults: results.length,
        cacheHit: false,
        responseTime,
        sources: [...new Set(results.map((r) => r.api || 'unknown'))],
      },
    };
  }

  /**
   * Search multiple sources in parallel and merge results
   */
  private async parallelSearch(keywords: string, page: number): Promise<SearchResult[]> {
    const searchPromises = [
      this.searchYTS(keywords, page),
      // Optionally add TPB search for additional results
      // this.searchTPB(keywords),
    ];

    const results = await Promise.allSettled(searchPromises);

    const allResults: SearchResult[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        allResults.push(...result.value);
      } else if (result.status === 'rejected') {
        this.logger.warn(`Search source failed: ${result.reason}`);
      }
    }

    // Deduplicate by IMDB ID
    const uniqueResults = this.deduplicateResults(allResults);

    // Sort by relevance (rating * seeds)
    return this.sortByRelevance(uniqueResults, keywords);
  }

  /**
   * Search YTS API
   */
  private async searchYTS(keywords: string, page: number): Promise<SearchResult[]> {
    try {
      const data = await this.ytsService.search(keywords, page);
      if (data === null || !Array.isArray(data)) {
        return [];
      }
      return data;
    } catch (err) {
      this.logger.error(`YTS search failed: ${err}`);
      return [];
    }
  }

  /**
   * Deduplicate results by IMDB ID
   */
  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Map<string, SearchResult>();

    for (const result of results) {
      if (result.imdb_id && !seen.has(result.imdb_id)) {
        seen.set(result.imdb_id, result);
      } else if (!result.imdb_id) {
        // For results without IMDB ID, use title+year as key
        const key = `${result.title}-${result.year}`;
        if (!seen.has(key)) {
          seen.set(key, result);
        }
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Sort results by relevance
   * Priority: rating * total seeds
   */
  private sortByRelevance(results: SearchResult[], keywords: string): SearchResult[] {
    const lowerKeywords = keywords.toLowerCase();

    return results.sort((a, b) => {
      // Exact title match gets priority
      const aExactMatch = a.title.toLowerCase() === lowerKeywords;
      const bExactMatch = b.title.toLowerCase() === lowerKeywords;

      if (aExactMatch && !bExactMatch) return -1;
      if (!aExactMatch && bExactMatch) return 1;

      // Title contains keywords
      const aContains = a.title.toLowerCase().includes(lowerKeywords);
      const bContains = b.title.toLowerCase().includes(lowerKeywords);

      if (aContains && !bContains) return -1;
      if (!aContains && bContains) return 1;

      // Calculate relevance score
      const aSeeds = a.torrents.reduce((sum, t) => sum + t.seeds, 0);
      const bSeeds = b.torrents.reduce((sum, t) => sum + t.seeds, 0);

      const aScore = (a.rating || 0) * Math.log(aSeeds + 1);
      const bScore = (b.rating || 0) * Math.log(bSeeds + 1);

      return bScore - aScore;
    });
  }

  /**
   * Clear cache for a specific query or all search cache
   */
  async clearCache(keywords?: string): Promise<void> {
    if (keywords) {
      const prefix = `search:${keywords.toLowerCase().trim()}:`;
      let cleared = 0;
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
          cleared++;
        }
      }
      this.logger.log(`Cleared ${cleared} cache entries for "${keywords}"`);
    } else {
      const size = this.cache.size;
      this.cache.clear();
      this.logger.log(`Cleared all ${size} search cache entries`);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalKeys: number;
    totalMemory: string;
  }> {
    return {
      totalKeys: this.cache.size,
      totalMemory: 'in-memory',
    };
  }
}
