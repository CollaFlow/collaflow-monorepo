import { describe, it, expect } from 'vitest';
import { AppModule } from './app.module';

describe('core', () => {
  it('exports AppModule', () => {
    expect(AppModule).toBeDefined();
  });
});
