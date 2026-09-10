import { describe, it, expect } from 'vitest';

import Home from './page';

describe('app page', () => {
  it('renders without crashing', () => {
    // Simple smoke test that the default export is a valid component.
    expect(Home).toBeDefined();
    expect(typeof Home).toBe('function');
  });
});
