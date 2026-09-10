import { describe, it, expect } from 'vitest';
import { createMindMap } from './index';

describe('mind', () => {
  it('exports a mind map factory', () => {
    expect(typeof createMindMap).toBe('function');
  });
});
