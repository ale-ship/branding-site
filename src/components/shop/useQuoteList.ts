'use client';

import { useCallback, useSyncExternalStore } from 'react';
import type { QuoteItem } from '@/lib/api/types';
import { addItem, parseList, QUOTE_LIST_KEY, removeItem, setQuantity } from '@/lib/quote-list';

/**
 * The quote list in localStorage, shared by every component and every tab. Storage can be
 * missing or blocked (private mode, previews): the list then lives only for this page view.
 */

const CHANGE = 'noorcom-quote-list-change';
const EMPTY: QuoteItem[] = [];
let memory: string | null = null;
let cache: { raw: string | null; list: QuoteItem[] } = { raw: null, list: EMPTY };

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(QUOTE_LIST_KEY);
  } catch {
    return memory;
  }
}

function snapshot(): QuoteItem[] {
  const raw = readRaw();
  if (raw !== cache.raw) cache = { raw, list: parseList(raw) };
  return cache.list;
}

function write(list: QuoteItem[]) {
  const raw = list.length ? JSON.stringify(list) : null;
  memory = raw;
  try {
    if (raw) window.localStorage.setItem(QUOTE_LIST_KEY, raw);
    else window.localStorage.removeItem(QUOTE_LIST_KEY);
  } catch {
    // Storage blocked: `memory` keeps the list for this page view.
  }
  window.dispatchEvent(new Event(CHANGE));
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === QUOTE_LIST_KEY) onChange();
  };
  window.addEventListener(CHANGE, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener('storage', onStorage);
  };
}

export function useQuoteList() {
  // The server renders an empty list; the real one appears after hydration.
  const items = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  const add = useCallback((item: QuoteItem) => write(addItem(snapshot(), item)), []);
  const update = useCallback((key: string, quantity: number) => write(setQuantity(snapshot(), key, quantity)), []);
  const remove = useCallback((key: string) => write(removeItem(snapshot(), key)), []);
  const clear = useCallback(() => write([]), []);
  return { items, add, update, remove, clear };
}
