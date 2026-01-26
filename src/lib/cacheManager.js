/**
 * Blueprint Service Caching Layer
 * 
 * Implements intelligent caching for blueprint queries with Redis-compatible interface
 * Can be swapped between in-memory cache (development) and Redis (production on Vercel)
 * 
 * Supported backends:
 * - Memory cache (development, single-instance)
 * - Upstash Redis (production on Vercel, serverless-compatible)
 * - None (caching disabled)
 * 
 * IMPORTANT: Vercel Serverless Functions have volatile memory!
 * Each request can spin up a new instance, so in-memory caching won't persist.
 * Use Upstash Redis in production: https://upstash.com (free tier available)
 */

const CACHE_CONFIG = {
  // Cache TTLs (in seconds)
  TTL: {
    FEED: 5 * 60,              // 5 minutes
    USER_LIKES: 5 * 60,        // 5 minutes
    TRENDING: 60 * 60,         // 1 hour
    FULL_BLUEPRINT: 30 * 60,   // 30 minutes
    USER_STATS: 15 * 60,       // 15 minutes
    POPULAR_TAGS: 24 * 60 * 60 // 24 hours
  },
  
  // Cache key prefixes
  KEYS: {
    FEED: 'blueprint:feed:page:',
    USER_LIKES: 'user:',
    USER_LIKES_SUFFIX: ':likes',
    TRENDING: 'blueprint:trending:',
    BLUEPRINT_FULL: 'blueprint:',
    BLUEPRINT_FULL_SUFFIX: ':full',
    USER_STATS: 'user:',
    USER_STATS_SUFFIX: ':stats',
    POPULAR_TAGS: 'tags:popular'
  }
};

// In-memory cache implementation with automatic TTL-based expiration
class MemoryCache {
  constructor() {
    this.store = new Map();
    this.timers = new Map();
  }

  async set(key, value, ttl = 300) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    this.store.set(key, value);

    const timer = setTimeout(() => {
      this.store.delete(key);
      this.timers.delete(key);
    }, ttl * 1000);

    this.timers.set(key, timer);
  }

  async get(key) {
    return this.store.get(key) || null;
  }

  async del(key) {
    this.store.delete(key);
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
  }

  async delPattern(pattern) {
    const regex = new RegExp(pattern);
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        await this.del(key);
      }
    }
  }

  async clear() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.store.clear();
    this.timers.clear();
  }

  getStats() {
    return {
      size: this.store.size,
      keys: Array.from(this.store.keys())
    };
  }
}

// Upstash Redis implementation - serverless-compatible Redis for Vercel
// Setup: Create free account at https://upstash.com, get REST API URL and token
// Set env vars: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
class UpstashRedisCache {
  constructor(url, token) {
    this.url = url;
    this.token = token;
    this.requestCount = 0;
    
    if (!url || !token) {
      console.warn('[Cache] Upstash Redis URL or token missing. Using no-op cache.');
      this.enabled = false;
    } else {
      this.enabled = true;
      console.log('[Cache] Using Upstash Redis (serverless-compatible)');
    }
  }

  async request(command, args = []) {
    if (!this.enabled) return null;
    
    try {
      this.requestCount++;
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          command: command,
          args: args
        })
      });

      if (!response.ok) {
        throw new Error(`Redis error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.result;
    } catch (error) {
      console.error('[Cache] Redis request failed:', error.message);
      return null;
    }
  }

  async set(key, value, ttl = 300) {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await this.request('SETEX', [key, ttl, serialized]);
    } else {
      await this.request('SET', [key, serialized]);
    }
  }

  async get(key) {
    const value = await this.request('GET', [key]);
    if (value) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return null;
  }

  async del(key) {
    await this.request('DEL', [key]);
  }

  async delPattern(pattern) {
    // SCAN for keys matching pattern, then delete them
    try {
      const regex = new RegExp(pattern);
      let cursor = '0';
      let keysToDelete = [];
      
      do {
        const result = await this.request('SCAN', [cursor]);
        if (!result || result.length < 2) break;
        
        cursor = result[0];
        const keys = result[1] || [];
        
        for (const key of keys) {
          if (regex.test(key)) {
            keysToDelete.push(key);
          }
        }
      } while (cursor !== '0' && cursor !== 0);
      
      if (keysToDelete.length > 0) {
        await this.request('DEL', keysToDelete);
      }
    } catch (error) {
      console.error('[Cache] Pattern delete failed:', error.message);
    }
  }

  async clear() {
    await this.request('FLUSHDB', []);
  }

  getStats() {
    return {
      type: 'Upstash Redis',
      requestCount: this.requestCount
    };
  }
}

// No-op cache implementation (caching disabled)
class NoOpCache {
  async set(key, value, ttl) { /* no-op */ }
  async get(key) { return null; }
  async del(key) { /* no-op */ }
  async delPattern(pattern) { /* no-op */ }
  async clear() { /* no-op */ }
  getStats() { return { size: 0, keys: [] }; }
}

// Cache manager - handles blueprint-specific caching logic
class CacheManager {
  constructor(backend = null) {
    // Auto-detect backend based on environment
    if (!backend) {
      const isProduction = import.meta.env.PROD;
      const hasUpstash = import.meta.env.VITE_UPSTASH_REDIS_REST_URL && import.meta.env.VITE_UPSTASH_REDIS_REST_TOKEN;
      
      if (isProduction && hasUpstash) {
        backend = 'upstash';
      } else if (isProduction) {
        console.warn('[Cache] Production detected but Upstash Redis not configured. Using memory cache (NOT RECOMMENDED for Vercel)');
        backend = 'memory';
      } else {
        backend = 'memory';
      }
    }

    if (backend === 'memory') {
      this.cache = new MemoryCache();
      console.log('[Cache] Using in-memory cache (development only)');
    } else if (backend === 'upstash') {
      this.cache = new UpstashRedisCache(
        import.meta.env.VITE_UPSTASH_REDIS_REST_URL,
        import.meta.env.VITE_UPSTASH_REDIS_REST_TOKEN
      );
    } else {
      this.cache = new NoOpCache();
      console.log('[Cache] Caching disabled');
    }
    
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
  }

  // Get blueprint feed page with caching
  async getBlueprintFeed(page = 0, fetchFn) {
    const key = `${CACHE_CONFIG.KEYS.FEED}${page}`;
    
    const cached = await this.cache.get(key);
    if (cached) {
      this.stats.hits++;
      console.log(`[Cache HIT] Blueprint feed page ${page}`);
      return cached;
    }

    this.stats.misses++;
    const data = await fetchFn();
    await this.cache.set(key, data, CACHE_CONFIG.TTL.FEED);
    console.log(`[Cache SET] Blueprint feed page ${page} (${CACHE_CONFIG.TTL.FEED}s TTL)`);
    this.stats.sets++;
    
    return data;
  }

  // Get user's liked blueprint IDs
  async getUserLikes(userId, fetchFn) {
    const key = `${CACHE_CONFIG.KEYS.USER_LIKES}${userId}${CACHE_CONFIG.KEYS.USER_LIKES_SUFFIX}`;
    
    const cached = await this.cache.get(key);
    if (cached) {
      this.stats.hits++;
      console.log(`[Cache HIT] User likes for ${userId}`);
      return cached;
    }

    this.stats.misses++;
    const data = await fetchFn();
    await this.cache.set(key, data, CACHE_CONFIG.TTL.USER_LIKES);
    console.log(`[Cache SET] User likes for ${userId} (${CACHE_CONFIG.TTL.USER_LIKES}s TTL)`);
    this.stats.sets++;
    
    return data;
  }

  // Get trending blueprints
  async getTrendingBlueprints(days = 7, fetchFn) {
    const key = `${CACHE_CONFIG.KEYS.TRENDING}${days}`;
    
    const cached = await this.cache.get(key);
    if (cached) {
      this.stats.hits++;
      console.log(`[Cache HIT] Trending blueprints (${days} days)`);
      return cached;
    }

    this.stats.misses++;
    const data = await fetchFn();
    await this.cache.set(key, data, CACHE_CONFIG.TTL.TRENDING);
    console.log(`[Cache SET] Trending blueprints (${CACHE_CONFIG.TTL.TRENDING}s TTL)`);
    this.stats.sets++;
    
    return data;
  }

  // Get full blueprint with all related data
  async getFullBlueprint(blueprintId, fetchFn) {
    const key = `${CACHE_CONFIG.KEYS.BLUEPRINT_FULL}${blueprintId}${CACHE_CONFIG.KEYS.BLUEPRINT_FULL_SUFFIX}`;
    
    const cached = await this.cache.get(key);
    if (cached) {
      this.stats.hits++;
      console.log(`[Cache HIT] Full blueprint ${blueprintId}`);
      return cached;
    }

    this.stats.misses++;
    const data = await fetchFn();
    await this.cache.set(key, data, CACHE_CONFIG.TTL.FULL_BLUEPRINT);
    console.log(`[Cache SET] Full blueprint ${blueprintId} (${CACHE_CONFIG.TTL.FULL_BLUEPRINT}s TTL)`);
    this.stats.sets++;
    
    return data;
  }

  // Get user's blueprint statistics
  async getUserStats(userId, fetchFn) {
    const key = `${CACHE_CONFIG.KEYS.USER_STATS}${userId}${CACHE_CONFIG.KEYS.USER_STATS_SUFFIX}`;
    
    const cached = await this.cache.get(key);
    if (cached) {
      this.stats.hits++;
      console.log(`[Cache HIT] User stats for ${userId}`);
      return cached;
    }

    this.stats.misses++;
    const data = await fetchFn();
    await this.cache.set(key, data, CACHE_CONFIG.TTL.USER_STATS);
    console.log(`[Cache SET] User stats for ${userId} (${CACHE_CONFIG.TTL.USER_STATS}s TTL)`);
    this.stats.sets++;
    
    return data;
  }

  // Get popular tags
  async getPopularTags(fetchFn) {
    const key = CACHE_CONFIG.KEYS.POPULAR_TAGS;
    
    const cached = await this.cache.get(key);
    if (cached) {
      this.stats.hits++;
      console.log(`[Cache HIT] Popular tags`);
      return cached;
    }

    this.stats.misses++;
    const data = await fetchFn();
    await this.cache.set(key, data, CACHE_CONFIG.TTL.POPULAR_TAGS);
    console.log(`[Cache SET] Popular tags (${CACHE_CONFIG.TTL.POPULAR_TAGS}s TTL)`);
    this.stats.sets++;
    
    return data;
  }

  async invalidateFeed() {
    await this.cache.delPattern(`^${CACHE_CONFIG.KEYS.FEED}.*`);
    console.log('[Cache CLEAR] All feed pages');
    this.stats.deletes++;
  }

  async invalidateUserLikes(userId) {
    const key = `${CACHE_CONFIG.KEYS.USER_LIKES}${userId}${CACHE_CONFIG.KEYS.USER_LIKES_SUFFIX}`;
    await this.cache.del(key);
    console.log(`[Cache CLEAR] User likes for ${userId}`);
    this.stats.deletes++;
  }

  async invalidateTrending() {
    await this.cache.delPattern(`^${CACHE_CONFIG.KEYS.TRENDING}.*`);
    console.log('[Cache CLEAR] All trending lists');
    this.stats.deletes++;
  }

  async invalidateBlueprint(blueprintId) {
    const key = `${CACHE_CONFIG.KEYS.BLUEPRINT_FULL}${blueprintId}${CACHE_CONFIG.KEYS.BLUEPRINT_FULL_SUFFIX}`;
    await this.cache.del(key);
    console.log(`[Cache CLEAR] Full blueprint ${blueprintId}`);
    this.stats.deletes++;
  }

  async invalidateUserStats(userId) {
    const key = `${CACHE_CONFIG.KEYS.USER_STATS}${userId}${CACHE_CONFIG.KEYS.USER_STATS_SUFFIX}`;
    await this.cache.del(key);
    console.log(`[Cache CLEAR] User stats for ${userId}`);
    this.stats.deletes++;
  }

  async invalidateTags() {
    await this.cache.del(CACHE_CONFIG.KEYS.POPULAR_TAGS);
    console.log('[Cache CLEAR] Popular tags');
    this.stats.deletes++;
  }

  async clear() {
    await this.cache.clear();
    console.log('[Cache CLEAR] All cache cleared');
    this.stats = { hits: 0, misses: 0, sets: 0, deletes: 0 };
  }

  // Get cache statistics and hit rate
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) : 0;
    
    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      total,
      backendStats: this.cache.getStats()
    };
  }

  // Print cache statistics to console
  printStats() {
    const stats = this.getStats();
    console.log('\n========== CACHE STATISTICS ==========');
    console.log(`Hits: ${stats.hits}`);
    console.log(`Misses: ${stats.misses}`);
    console.log(`Total: ${stats.total}`);
    console.log(`Hit Rate: ${stats.hitRate}`);
    console.log(`Sets: ${stats.sets}`);
    console.log(`Deletes: ${stats.deletes}`);
    console.log(`Cached Keys: ${stats.backendStats.size}`);
    console.log('=====================================\n');
  }
}

// Create singleton instance with auto-detection
const cacheManager = new CacheManager();

export default cacheManager;
export { CacheManager, MemoryCache, UpstashRedisCache, NoOpCache, CACHE_CONFIG };

/**
 * SETUP INSTRUCTIONS FOR VERCEL + UPSTASH REDIS
 * 
 * 1. Create Upstash account (free tier):
 *    - Go to https://upstash.com and sign up
 *    - Create a new Redis database
 * 
 * 2. Get credentials:
 *    - Copy REST API URL and token from Upstash dashboard
 * 
 * 3. Set environment variables in Vercel:
 *    - Go to Vercel project settings → Environment Variables
 *    - Add: VITE_UPSTASH_REDIS_REST_URL=your_url
 *    - Add: VITE_UPSTASH_REDIS_REST_TOKEN=your_token
 * 
 * 4. Redeploy:
 *    - Push changes or redeploy from Vercel dashboard
 *    - Cache manager will auto-detect and use Redis in production
 * 
 * Benefits:
 * ✓ Persistent cache across Vercel cold starts
 * ✓ Shared cache for all serverless function instances
 * ✓ Free tier: 10,000 commands/day (plenty for small projects)
 * ✓ Global distribution and automatic failover
 */
