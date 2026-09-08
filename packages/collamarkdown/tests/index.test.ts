import { describe, expect, it } from 'vitest';

import collamarkdown from '../src/index';

describe('@collaflow/collamarkdown', () => {
  it('导出占位对象', () => {
    expect(collamarkdown).toEqual({});
  });
});
