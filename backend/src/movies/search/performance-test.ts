/**
 * Performance Test Script for Optimized Search
 *
 * Run with: node -r ts-node/register performance-test.ts
 * Or: npm run test:performance
 */

import { Test } from '@nestjs/testing';
import { HttpModule } from '@nestjs/axios';
import * as https from 'https';
import { OptimizedSearchService } from './optimized-search.service';
import { YtsService } from '../yts/yts.service';
import { TpbService } from '../tpb/tpb.service';

interface TestResult {
  query: string;
  iteration: number;
  cacheHit: boolean;
  responseTime: number;
  resultCount: number;
}

async function runPerformanceTests() {
  console.log('🚀 Starting Search Performance Tests...\n');

  // Create testing module with real services
  const module = await Test.createTestingModule({
    imports: [
      HttpModule.register({
        httpsAgent: new https.Agent({
          rejectUnauthorized: false,
        }),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          Accept: 'application/json',
        },
      }),
    ],
    providers: [OptimizedSearchService, YtsService, TpbService],
  }).compile();

  const searchService = module.get<OptimizedSearchService>(OptimizedSearchService);

  const testQueries = ['Inception', 'The Dark Knight', 'Interstellar', 'Matrix', 'Pulp Fiction'];

  const results: TestResult[] = [];

  console.log('📊 Test Configuration:');
  console.log(`- Number of queries: ${testQueries.length}`);
  console.log(`- Iterations per query: 3 (1 cache miss + 2 cache hits)`);
  console.log(`- Redis cache TTL: 3600s (1 hour)\n`);

  // Clear cache before starting
  console.log('🧹 Clearing cache...');
  await searchService.clearCache();
  console.log('✅ Cache cleared\n');

  // Run tests
  for (const query of testQueries) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing query: "${query}"`);
    console.log('='.repeat(60));

    for (let i = 1; i <= 3; i++) {
      const iteration = i;
      console.log(`\n  Iteration ${iteration}/3...`);

      const result = await searchService.search(query, 1);

      results.push({
        query,
        iteration,
        cacheHit: result.stats.cacheHit,
        responseTime: result.stats.responseTime,
        resultCount: result.stats.totalResults,
      });

      console.log(`    ✓ Cache ${result.stats.cacheHit ? 'HIT' : 'MISS'}`);
      console.log(`    ✓ Response time: ${result.stats.responseTime}ms`);
      console.log(`    ✓ Results found: ${result.stats.totalResults}`);
      console.log(`    ✓ Sources: ${result.stats.sources.join(', ')}`);

      // Small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  // Analyze results
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('📈 Performance Analysis');
  console.log('='.repeat(60));

  const cacheMisses = results.filter((r) => !r.cacheHit);
  const cacheHits = results.filter((r) => r.cacheHit);

  console.log(`\n🔴 Cache Misses (${cacheMisses.length})`);
  console.log(
    `  Average response time: ${Math.round(
      cacheMisses.reduce((sum, r) => sum + r.responseTime, 0) / cacheMisses.length,
    )}ms`,
  );
  console.log(`  Min: ${Math.min(...cacheMisses.map((r) => r.responseTime))}ms`);
  console.log(`  Max: ${Math.max(...cacheMisses.map((r) => r.responseTime))}ms`);

  console.log(`\n🟢 Cache Hits (${cacheHits.length})`);
  console.log(
    `  Average response time: ${Math.round(
      cacheHits.reduce((sum, r) => sum + r.responseTime, 0) / cacheHits.length,
    )}ms`,
  );
  console.log(`  Min: ${Math.min(...cacheHits.map((r) => r.responseTime))}ms`);
  console.log(`  Max: ${Math.max(...cacheHits.map((r) => r.responseTime))}ms`);

  const avgCacheMiss = cacheMisses.reduce((sum, r) => sum + r.responseTime, 0) / cacheMisses.length;
  const avgCacheHit = cacheHits.reduce((sum, r) => sum + r.responseTime, 0) / cacheHits.length;
  const improvement = (((avgCacheMiss - avgCacheHit) / avgCacheMiss) * 100).toFixed(1);

  console.log(`\n⚡ Performance Improvement:`);
  console.log(`  Cache hits are ${improvement}% faster than cache misses`);
  console.log(`  Speed up: ${(avgCacheMiss / avgCacheHit).toFixed(1)}x faster`);

  // Cache statistics
  const cacheStats = await searchService.getCacheStats();
  console.log(`\n💾 Cache Statistics:`);
  console.log(`  Total cache keys: ${cacheStats.totalKeys}`);
  console.log(`  Memory usage: ${cacheStats.totalMemory}`);

  console.log(`\n${'='.repeat(60)}`);
  console.log('✅ Performance tests completed!');
  console.log(`${'='.repeat(60)}\n`);

  // Detailed results table
  console.log('\n📋 Detailed Results:');
  console.table(
    results.map((r) => ({
      Query: r.query,
      Iteration: r.iteration,
      Cache: r.cacheHit ? 'HIT' : 'MISS',
      'Time (ms)': r.responseTime,
      Results: r.resultCount,
    })),
  );

  process.exit(0);
}

// Run the tests
runPerformanceTests().catch((error) => {
  console.error('❌ Error running performance tests:', error);
  process.exit(1);
});
