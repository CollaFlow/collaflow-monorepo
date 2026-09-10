import { colors, typography, spacing, radius, shadow } from '../tokens';

export const darkTheme = {
  name: 'dark',
  colors: colors.dark,
  typography,
  spacing,
  radius,
  shadow,
} as const;

export type DarkTheme = typeof darkTheme;
