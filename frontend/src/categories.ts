import { useEffect, useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { getCategories } from './services/api';
import type { Category } from './types/v2';

/** One request per user for every list and form on the page; dropped when categories change. */
let cache: { userId: string; request: Promise<Category[]> } | null = null;
const listeners = new Set<() => void>();

export function invalidateCategories() {
  cache = null;
  listeners.forEach((listener) => listener());
}

function load(userId: string): Promise<Category[]> {
  if (cache?.userId !== userId) {
    const request = getCategories();
    request.catch(() => {
      if (cache?.request === request) cache = null;
    });
    cache = { userId, request };
  }
  return cache.request;
}

/** The user's categories, null while loading. */
export function useCategories(): Category[] | null {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const listener = () => setVersion((current) => current + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;
    let alive = true;
    load(userId)
      .then((next) => alive && setCategories(next))
      .catch(() => alive && setCategories([]));
    return () => {
      alive = false;
    };
  }, [user?.id, version]);

  return categories;
}
