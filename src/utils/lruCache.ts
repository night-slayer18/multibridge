/**
 * Simple LRU (Least Recently Used) Cache implementation
 * Used for connection and config caching with size limits
 */

interface CacheEntry<T> {
  value: T;
  lastAccessed: number;
}

export class LRUCache<K, V> {
  private cache: Map<K, CacheEntry<V>>;
  private maxSize: number;
  private ttl?: number; // Time to live in milliseconds

  constructor(maxSize: number = 100, ttl?: number) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    // Check if entry has expired
    if (this.ttl && Date.now() - entry.lastAccessed > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    // Update last accessed time (LRU)
    entry.lastAccessed = Date.now();
    return entry.value;
  }

  set(key: K, value: V): void {
    // If key already exists, update it
    if (this.cache.has(key)) {
      const entry = this.cache.get(key)!;
      entry.value = value;
      entry.lastAccessed = Date.now();
      return;
    }

    // If cache is full, remove least recently used item
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      value,
      lastAccessed: Date.now(),
    });
  }

  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    // Check if entry has expired
    if (this.ttl && Date.now() - entry.lastAccessed > this.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  // Get all keys (for iteration)
  keys(): IterableIterator<K> {
    return this.cache.keys();
  }

  // Get all entries (for cleanup)
  entries(): IterableIterator<[K, CacheEntry<V>]> {
    return this.cache.entries();
  }

  // Get entry by key (for internal use)
  getEntry(key: K): CacheEntry<V> | undefined {
    return this.cache.get(key);
  }
}

