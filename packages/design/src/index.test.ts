import { describe, it, expect } from 'vitest';
import { colors, typography, spacing, radius, shadow, lightTheme, darkTheme, collaflowPreset } from './index';

describe('design tokens', () => {
  it('exports all tokens', () => {
    expect(colors.light.background.primary).toBe('#F7F7F5');
    expect(typography.fontSize.base).toBe('16px');
    expect(spacing[4]).toBe('16px');
    expect(radius.md).toBe('8px');
    expect(shadow.card).toContain('rgba');
  });

  it('exports themes', () => {
    expect(lightTheme.name).toBe('light');
    expect(darkTheme.name).toBe('dark');
  });

  it('exports tailwind preset', () => {
    expect(collaflowPreset).toBeDefined();
    expect(collaflowPreset.darkMode).toEqual(['class']);
  });
});
