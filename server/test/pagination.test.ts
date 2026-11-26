import { describe, it, expect } from 'vitest';
import { parsePageParams } from '../src/platform/pagination.js';

describe('parsePageParams', () => {
  it('parses page and limit into an offset', () => {
    expect(parsePageParams({ page: '3', limit: '20' })).toEqual({ page: 3, limit: 20, offset: 40 });
  });
});
