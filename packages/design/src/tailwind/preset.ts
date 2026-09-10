import { colors, typography, spacing, radius, shadow } from '../tokens';
import type { Config } from 'tailwindcss';

export const collaflowPreset: Partial<Config> = {
  darkMode: ['class'],
  theme: {
    extend: {
      colors: {
        background: colors.light.background,
        foreground: colors.light.text.primary,
        muted: colors.light.text.secondary,
        border: colors.light.border,
        accent: colors.light.accent,
      },
      fontFamily: typography.fontFamily,
      fontSize: typography.fontSize,
      fontWeight: typography.fontWeight,
      spacing,
      borderRadius: radius,
      boxShadow: shadow,
    },
  },
};
