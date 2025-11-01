import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import Redis from 'ioredis';
import { of } from 'rxjs';
import { OptimizedSearchService } from './optimized-search.service';
import { YtsService } from '../yts/yts.service';
import { TpbService } from '../tpb/tpb.service';

// Mock Redis
jest.mock('ioredis');

describe('OptimizedSearchService', () => {
  let service: OptimizedSearchService;
  let ytsService: YtsService;
  let mockRedis: jest.Mocked<Redis>;

  const mockYtsResults = [
    {
      imdb_id: 'tt0111161',
      title: 'The Shawshank Redemption',
      year: 1994,
      synopsis: 'Two imprisoned men bond over a number of years',
      runtime: 142,
      genres: ['Drama'],
      image: 'https://example.com/shawshank.jpg',
      rating: 9.3,
      trailer: 'https://youtube.com/watch?v=test',
      torrents: [
        {
          resolution: '1080p',
          quality: '1080p',
          size: '2.5 GB',
          seeds: 1500,
          peers: 50,
          magnet: 'magnet:?xt=urn:btih:test1',
        },
        {
          resolution: '720p',
          quality: '720p',
          size: '1.2 GB',
          seeds: 800,
          peers: 30,
          magnet: 'magnet:?xt=urn:btih:test2',
        },
      ],
      api: 'yts',
    },
    {
      imdb_id: 'tt0068646',
      title: 'The Godfather',
      year: 1972,
      synopsis: 'The aging patriarch of an organized crime dynasty',
      runtime: 175,
      genres: ['Crime', 'Drama'],
      image: 'https://example.com/godfather.jpg',
      rating: 9.2,
      torrents: [
        {
          resolution: '1080p',
          quality: '1080p',
          size: '3.0 GB',
          seeds: 2000,
          peers: 75,
          magnet: 'magnet:?xt=urn:btih:test3',
        },
      ],
      api: 'yts',
    },
  ];

  beforeEach(async () => {
    // Create mock Redis instance
    const RedisMock = Redis as jest.MockedClass<typeof Redis>;
    mockRedis = new RedisMock() as jest.Mocked<Redis>;

    // Setup Redis mock methods
    mockRedis.get = jest.fn().mockResolvedValue(null);
    mockRedis.setex = jest.fn().mockResolvedValue('OK');
    mockRedis.del = jest.fn().mockResolvedValue(1);
    mockRedis.keys = jest.fn().mockResolvedValue([]);
    mockRedis.info = jest.fn().mockResolvedValue('used_memory_human:1.5M');

    // Create proper mock YTS and TPB services with HttpService mock
    const mockHttpService = {
      get: jest.fn(),
      post: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OptimizedSearchService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        YtsService,
        TpbService,
      ],
    }).compile();

    service = module.get<OptimizedSearchService>(OptimizedSearchService);
    ytsService = module.get<YtsService>(YtsService);

    // Replace the Redis instance in the service with our mock
    // biome-ignore lint: accessing private property for testing
    (service as any).redis = mockRedis;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('search', () => {
    it('should return cached results on cache hit', async () => {
      const keywords = 'Shawshank';
      const cachedData = JSON.stringify(mockYtsResults);

      mockRedis.get.mockResolvedValueOnce(cachedData);

      const result = await service.search(keywords, 1);

      expect(result.stats.cacheHit).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].title).toBe('The Shawshank Redemption');
      expect(mockRedis.get).toHaveBeenCalledWith('search:shawshank:1');
      expect(ytsService.search).not.toHaveBeenCalled();
    });

    it('should fetch from API on cache miss', async () => {
      const keywords = 'Godfather';

      mockRedis.get.mockResolvedValueOnce(null);
      (ytsService.search as jest.Mock).mockResolvedValueOnce(mockYtsResults);

      const result = await service.search(keywords, 1);

      expect(result.stats.cacheHit).toBe(false);
      expect(result.data).toHaveLength(2);
      expect(ytsService.search).toHaveBeenCalledWith(keywords, 1);
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should handle empty results', async () => {
      const keywords = 'NonexistentMovie123456';

      mockRedis.get.mockResolvedValueOnce(null);
      (ytsService.search as jest.Mock).mockResolvedValueOnce([]);

      const result = await service.search(keywords, 1);

      expect(result.stats.cacheHit).toBe(false);
      expect(result.data).toHaveLength(0);
      expect(result.stats.totalResults).toBe(0);
    });

    it('should handle API errors gracefully', async () => {
      const keywords = 'Error';

      mockRedis.get.mockResolvedValueOnce(null);
      (ytsService.search as jest.Mock).mockResolvedValueOnce(null); // YTS returns null on error

      const result = await service.search(keywords, 1);

      expect(result.data).toHaveLength(0);
      expect(result.stats.totalResults).toBe(0);
    });

    it('should deduplicate results by IMDB ID', async () => {
      const keywords = 'Test';
      const duplicateResults = [
        ...mockYtsResults,
        { ...mockYtsResults[0], api: 'tpb' }, // Duplicate with different source
      ];

      mockRedis.get.mockResolvedValueOnce(null);
      (ytsService.search as jest.Mock).mockResolvedValueOnce(duplicateResults);

      const result = await service.search(keywords, 1);

      // Should only have 2 unique movies, not 3
      expect(result.data).toHaveLength(2);
    });

    it('should sort results by relevance', async () => {
      const keywords = 'godfather';

      mockRedis.get.mockResolvedValueOnce(null);
      (ytsService.search as jest.Mock).mockResolvedValueOnce(mockYtsResults);

      const result = await service.search(keywords, 1);

      // "The Godfather" should be first as title contains exact keyword match
      expect(result.data[0].title).toBe('The Godfather');
    });

    it('should include response time in stats', async () => {
      const keywords = 'Test';

      mockRedis.get.mockResolvedValueOnce(null);
      (ytsService.search as jest.Mock).mockResolvedValueOnce(mockYtsResults);

      const result = await service.search(keywords, 1);

      expect(result.stats.responseTime).toBeGreaterThan(0);
      expect(typeof result.stats.responseTime).toBe('number');
    });

    it('should include sources in stats', async () => {
      const keywords = 'Test';

      mockRedis.get.mockResolvedValueOnce(null);
      (ytsService.search as jest.Mock).mockResolvedValueOnce(mockYtsResults);

      const result = await service.search(keywords, 1);

      expect(result.stats.sources).toContain('yts');
    });
  });

  describe('performance', () => {
    it('should respond faster with cache hit than cache miss', async () => {
      const keywords = 'Performance';
      const cachedData = JSON.stringify(mockYtsResults);

      // First request - cache miss
      mockRedis.get.mockResolvedValueOnce(null);
      (ytsService.search as jest.Mock).mockResolvedValueOnce(mockYtsResults);

      const missResult = await service.search(keywords, 1);
      const missTime = missResult.stats.responseTime;

      // Second request - cache hit
      mockRedis.get.mockResolvedValueOnce(cachedData);

      const hitResult = await service.search(keywords, 1);
      const hitTime = hitResult.stats.responseTime;

      // Cache hit should be significantly faster
      expect(hitTime).toBeLessThan(missTime);
      expect(hitTime).toBeLessThan(50); // Should be under 50ms
    });

    it('should handle concurrent requests efficiently', async () => {
      const keywords = 'Concurrent';

      mockRedis.get.mockResolvedValue(null);
      (ytsService.search as jest.Mock).mockResolvedValue(mockYtsResults);

      const promises = Array(10)
        .fill(null)
        .map(() => service.search(keywords, 1));

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // All requests should complete
      expect(results).toHaveLength(10);
      results.forEach((result) => {
        expect(result.data).toHaveLength(2);
      });

      // Should complete in reasonable time (parallelized)
      expect(totalTime).toBeLessThan(5000); // Less than 5 seconds for 10 requests
    });
  });

  describe('cache management', () => {
    it('should clear specific query cache', async () => {
      const keywords = 'ClearTest';

      mockRedis.keys.mockResolvedValueOnce(['search:cleartest:1', 'search:cleartest:2']);
      mockRedis.del.mockResolvedValueOnce(2);

      await service.clearCache(keywords);

      expect(mockRedis.keys).toHaveBeenCalledWith('search:cleartest:*');
      expect(mockRedis.del).toHaveBeenCalledWith('search:cleartest:1', 'search:cleartest:2');
    });

    it('should clear all cache when no keywords provided', async () => {
      mockRedis.keys.mockResolvedValueOnce([
        'search:movie1:1',
        'search:movie2:1',
        'search:movie3:1',
      ]);
      mockRedis.del.mockResolvedValueOnce(3);

      await service.clearCache();

      expect(mockRedis.keys).toHaveBeenCalledWith('search:*');
      expect(mockRedis.del).toHaveBeenCalledWith(
        'search:movie1:1',
        'search:movie2:1',
        'search:movie3:1',
      );
    });

    it('should get cache statistics', async () => {
      mockRedis.keys.mockResolvedValueOnce(['search:test1:1', 'search:test2:1']);
      mockRedis.info.mockResolvedValueOnce('used_memory_human:2.5M\nother:value');

      const stats = await service.getCacheStats();

      expect(stats.totalKeys).toBe(2);
      expect(stats.totalMemory).toBe('2.5M');
    });
  });

  describe('edge cases', () => {
    it('should handle cache read errors', async () => {
      const keywords = 'ErrorTest';

      mockRedis.get.mockRejectedValueOnce(new Error('Redis connection failed'));
      (ytsService.search as jest.Mock).mockResolvedValueOnce(mockYtsResults);

      const result = await service.search(keywords, 1);

      // Should fall back to API search
      expect(result.data).toHaveLength(2);
      expect(result.stats.cacheHit).toBe(false);
    });

    it('should handle cache write errors', async () => {
      const keywords = 'WriteError';

      mockRedis.get.mockResolvedValueOnce(null);
      mockRedis.setex.mockRejectedValueOnce(new Error('Write failed'));
      (ytsService.search as jest.Mock).mockResolvedValueOnce(mockYtsResults);

      // Should not throw error
      const result = await service.search(keywords, 1);

      expect(result.data).toHaveLength(2);
    });

    it('should normalize cache keys (lowercase, trim)', async () => {
      const keywords = '  UPPERCASE Test  ';

      mockRedis.get.mockResolvedValueOnce(null);
      (ytsService.search as jest.Mock).mockResolvedValueOnce(mockYtsResults);

      await service.search(keywords, 1);

      expect(mockRedis.get).toHaveBeenCalledWith('search:uppercase test:1');
    });

    it('should handle pagination correctly', async () => {
      const keywords = 'Pagination';

      mockRedis.get.mockResolvedValueOnce(null);
      (ytsService.search as jest.Mock).mockResolvedValueOnce(mockYtsResults);

      await service.search(keywords, 3);

      expect(ytsService.search).toHaveBeenCalledWith(keywords, 3);
      expect(mockRedis.setex).toHaveBeenCalledWith('search:pagination:3', 3600, expect.any(String));
    });
  });
});
