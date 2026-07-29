import type { PaginationMeta } from './types.js';

/** Shape of every paginated list response. */
export interface Page<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Walk a paginated endpoint one record at a time, fetching the next page only
 * when the previous one is exhausted.
 */
export async function* paginate<T>(
  fetchPage: (page: number) => Promise<Page<T>>,
  startPage = 1,
): AsyncGenerator<T, void, undefined> {
  let page = Math.max(1, startPage);

  for (;;) {
    const result = await fetchPage(page);

    for (const item of result.data) yield item;

    // Stop on an empty page even if `meta.pages` disagrees — a stale count
    // must not turn into an endless loop.
    if (result.data.length === 0) return;
    if (page >= result.meta.pages) return;

    page += 1;
  }
}

/** Drain an async iterable into an array. */
export async function collect<T>(source: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of source) items.push(item);
  return items;
}
