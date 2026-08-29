import { Injectable } from '@angular/core';

const PROFILE_CACHE_KEY = 'dragons-profile-cache-v1';
const FRIENDS_CACHE_KEY = 'dragons-friends-cache-v1';

interface CacheEntry<T> {
  cachedAt: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class OfflineProfileService {
  readProfile<T>(userId: string): T | null {
    return this.read<T>(PROFILE_CACHE_KEY, userId);
  }

  writeProfile<T>(userId: string, data: T): void {
    this.write(PROFILE_CACHE_KEY, userId, data);
  }

  readFriends<T>(): T | null {
    return this.readRoot<T>(FRIENDS_CACHE_KEY);
  }

  writeFriends<T>(data: T): void {
    this.writeRoot(FRIENDS_CACHE_KEY, data);
  }

  private read<T>(storageKey: string, id: string): T | null {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const map = JSON.parse(raw) as Record<string, CacheEntry<T>>;
      return map[id]?.data ?? null;
    } catch {
      return null;
    }
  }

  private write<T>(storageKey: string, id: string, data: T): void {
    try {
      const raw = localStorage.getItem(storageKey);
      const map = raw ? (JSON.parse(raw) as Record<string, CacheEntry<T>>) : {};
      map[id] = { cachedAt: new Date().toISOString(), data };
      localStorage.setItem(storageKey, JSON.stringify(map));
    } catch {
      /* ignore quota / private mode */
    }
  }

  private readRoot<T>(storageKey: string): T | null {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const entry = JSON.parse(raw) as CacheEntry<T>;
      return entry.data ?? null;
    } catch {
      return null;
    }
  }

  private writeRoot<T>(storageKey: string, data: T): void {
    try {
      const entry: CacheEntry<T> = { cachedAt: new Date().toISOString(), data };
      localStorage.setItem(storageKey, JSON.stringify(entry));
    } catch {
      /* ignore */
    }
  }
}
