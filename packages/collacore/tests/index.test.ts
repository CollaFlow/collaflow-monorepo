import { describe, expect, it } from 'vitest';

import collacore from '../src/index';

describe('@collaflow/collacore', () => {
  it('导出占位对象', () => {
    expect(collacore).toEqual({});
  });
});
