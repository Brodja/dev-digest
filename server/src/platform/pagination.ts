import { ValidationError } from './errors.js';

/**
 * Page parameters for list endpoints (`?page=&limit=`). `page` is 1-based.
 * Shared by the upcoming paginated list routes (pulls, runs, findings).
 */

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface PageParams {
  page: number;
  limit: number;
  /** Rows to skip: (page - 1) * limit. */
  offset: number;
}

export function parsePageParams(query: { page?: string; limit?: string }): PageParams {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? DEFAULT_PAGE_SIZE : Number(query.limit);

  if (!Number.isInteger(page) || page < 1) {
    throw new ValidationError('page must be a positive integer', { page: query.page });
  }
  if (!Number.isInteger(limit) || limit < 1) {
    throw new ValidationError('limit must be a positive integer', { limit: query.limit });
  }

  // Large pages are capped rather than rejected, so old clients keep working.
  const capped = Math.min(limit, MAX_PAGE_SIZE);
  return { page, limit: capped, offset: (page - 1) * capped };
}
