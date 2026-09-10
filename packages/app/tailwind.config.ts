import type { Config } from 'tailwindcss';
import { collaflowPreset, radius } from '@collaflow/design';

const config: Config = {
  presets: [collaflowPreset],
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'var(--cf-border-default)',
        input: 'var(--cf-border-default)',
        ring: 'var(--cf-accent-blue)',
        background: 'var(--cf-bg-primary)',
        foreground: 'var(--cf-text-primary)',
        primary: {
          DEFAULT: 'var(--cf-text-primary)',
          foreground: 'var(--cf-bg-secondary)',
        },
        secondary: {
          DEFAULT: 'var(--cf-bg-tertiary)',
          foreground: 'var(--cf-text-primary)',
        },
        destructive: {
          DEFAULT: 'var(--cf-accent-red)',
          foreground: 'var(--cf-bg-secondary)',
        },
        muted: {
          DEFAULT: 'var(--cf-bg-tertiary)',
          foreground: 'var(--cf-text-secondary)',
        },
        accent: {
          DEFAULT: 'var(--cf-bg-tertiary)',
          foreground: 'var(--cf-text-primary)',
        },
        popover: {
          DEFAULT: 'var(--cf-bg-secondary)',
          foreground: 'var(--cf-text-primary)',
        },
        card: {
          DEFAULT: 'var(--cf-bg-secondary)',
          foreground: 'var(--cf-text-primary)',
        },
      },
      borderRadius: {
        lg: radius.lg,
        md: radius.md,
        sm: radius.sm,
      },
    },
  },
  plugins: [],
};

export default config;
