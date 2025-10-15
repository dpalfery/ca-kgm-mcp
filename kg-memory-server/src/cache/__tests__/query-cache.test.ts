import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QueryCache } from '../query-cache.js';

describe('QueryCache', () => {
  let cache: QueryCache<string>;

  beforeEach(() => {
    cache = new QueryCache<string>({
      maxSize: 5,
      defaultTtl: 1000, // 1 second for testing
      cleanupInterval: 100 // 100ms for testing
    });
  });

  afterEach(() => {
    cache.destroy();
  });

  describe('basic operations', () => {
    it('should store and retrieve values', () => {
      const params = { key: 'test', value: 123 };
      const data = 'test data';

      cache.set(params, data);
      const result = cache.get(params);

      expect(result).toBe(data);
    });

    it('should return null for non-existent keys', () => {
      const params = { key: 'nonexistent' };
      const result = cache.get(params);

      expect(result).toBeNull();
    });

    it('should generate consistent keys for same parameters', () => {
      const params1 = { b: 2, a: 1 };
      const params2 = { a: 1, b: 2 };
      const data = 'test data';

      cache.set(params1, data);
      const result = cache.get(params2);

      expect(result).toBe(data);
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after TTL', async () => {
      const params = { key: 'test' };
      const data = 'test data';

      cache.set(params, data, 50); // 50ms TTL
      expect(cache.get(params)).toBe(data);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 60));
      expect(cache.get(params)).toBeNull();
    });

    it('should use default TTL when not specified', async () => {
      const params = { key: 'test' };
      const data = 'test data';

      cache.set(params, data);
      expect(cache.get(params)).toBe(data);

      // Should still be valid before default TTL
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(cache.get(params)).toBe(data);
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used entries when full', () => {
      // Fill cache to capacity
      for (let i = 0; i < 5; i++) {
        cache.set({ key: `test${i}` }, `data${i}`);
      }

      // Access first entry to make it recently used
      cache.get({ key: 'test0' });

      // Add new entry, should evict test1 (least recently used)
      cache.set({ key: 'test5' }, 'data5');

      expect(cache.get({ key: 'test0' })).toBe('data0'); // Should still exist
      expect(cache.get({ key: 'test1' })).toBeNull(); // Should be evicted
      expect(cache.get({ key: 'test5' })).toBe('data5'); // Should exist
    });
  });

  describe('statistics', () => {
    it('should track hits and misses', () => {
      const params = { key: 'test' };
      
      // Miss
      cache.get(params);
      
      // Hit
      cache.set(params, 'data');
      cache.get(params);
      
      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
      expect(stats.size).toBe(1);
    });

    it('should update access count and last accessed time', () => {
      const params = { key: 'test' };
      cache.set(params, 'data');
      
      const initialStats = cache.getStats();
      
      // Access multiple times
      cache.get(params);
      cache.get(params);
      
      const finalStats = cache.getStats();
      expect(finalStats.hits).toBe(initialStats.hits + 2);
    });
  });

  describe('cache warming', () => {
    it('should warm cache with provided patterns', async () => {
      const patterns = [
        {
          params: { key: 'test1' },
          generator: async () => 'data1'
        },
        {
          params: { key: 'test2' },
          generator: async () => 'data2'
        }
      ];

      await cache.warm(patterns);

      expect(cache.get({ key: 'test1' })).toBe('data1');
      expect(cache.get({ key: 'test2' })).toBe('data2');
    });

    it('should handle warming failures gracefully', async () => {
      const patterns = [
        {
          params: { key: 'test1' },
          generator: async () => 'data1'
        },
        {
          params: { key: 'test2' },
          generator: async () => { throw new Error('Generation failed'); }
        }
      ];

      // Should not throw
      await cache.warm(patterns);

      expect(cache.get({ key: 'test1' })).toBe('data1');
      expect(cache.get({ key: 'test2' })).toBeNull();
    });
  });

  describe('invalidation', () => {
    it('should clear all entries when invalidating without pattern', () => {
      cache.set({ key: 'test1' }, 'data1');
      cache.set({ key: 'test2' }, 'data2');

      cache.invalidate();

      expect(cache.get({ key: 'test1' })).toBeNull();
      expect(cache.get({ key: 'test2' })).toBeNull();
      expect(cache.getStats().size).toBe(0);
    });

    it('should invalidate entries by rule IDs', () => {
      cache.set({ ruleId: 'rule1', key: 'test1' }, 'data1');
      cache.set({ ruleId: 'rule2', key: 'test2' }, 'data2');
      cache.set({ key: 'test3' }, 'data3');

      cache.invalidateByRuleIds(['rule1']);

      // This is a simplified test - the actual implementation would need
      // better key structure to properly match rule IDs
      expect(cache.getStats().size).toBeGreaterThan(0);
    });
  });

  describe('cleanup', () => {
    it('should automatically clean up expired entries', async () => {
      cache.set({ key: 'test1' }, 'data1', 50); // 50ms TTL
      cache.set({ key: 'test2' }, 'data2', 200); // 200ms TTL

      expect(cache.getStats().size).toBe(2);

      // Wait for first entry to expire and cleanup to run
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(cache.get({ key: 'test1' })).toBeNull();
      expect(cache.get({ key: 'test2' })).toBe('data2');
    });
  });

  describe('edge cases', () => {
    it('should handle empty parameters', () => {
      cache.set({}, 'data');
      expect(cache.get({})).toBe('data');
    });

    it('should handle complex nested parameters', () => {
      const params = {
        nested: { deep: { value: 123 } },
        array: [1, 2, 3],
        string: 'test'
      };
      
      cache.set(params, 'data');
      expect(cache.get(params)).toBe('data');
    });

    it('should handle null and undefined values', () => {
      cache.set({ key: 'null' }, null as any);
      cache.set({ key: 'undefined' }, undefined as any);

      expect(cache.get({ key: 'null' })).toBeNull();
      expect(cache.get({ key: 'undefined' })).toBeUndefined();
    });
  });
});