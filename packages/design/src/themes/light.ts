import { colors, typography, spacing, radius, shadow } from '../tokens';

export const lightTheme = {
  name: 'light',
  colors: colors.light,
  typography,
  spacing,
  radius,
  shadow,
} as const;

export type LightTheme = typeof lightTheme;
