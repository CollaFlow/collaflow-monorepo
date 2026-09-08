import { describe, expect, it } from 'vitest';

import collamind from '../src/index';

describe('@collaflow/collamind', () => {
  it('导出占位对象', () => {
    expect(collamind).toEqual({});
  });
});
