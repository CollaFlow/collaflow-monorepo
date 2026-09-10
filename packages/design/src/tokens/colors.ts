export const colors = {
  light: {
    background: {
      primary: '#F7F7F5',
      secondary: '#FFFFFF',
      tertiary: '#F6F5F4',
    },
    text: {
      primary: '#1F1F1F',
      secondary: '#6B6B6B',
      disabled: '#9B9B9B',
    },
    border: {
      default: '#E5E5E5',
      strong: '#D3D3D3',
    },
    accent: {
      blue: '#2383E2',
      green: '#0F7B6C',
      orange: '#DFAB01',
      red: '#E03E3E',
    },
  },
  dark: {
    background: {
      primary: '#191919',
      secondary: '#202020',
      tertiary: '#2A2A2A',
    },
    text: {
      primary: '#E8E8E8',
      secondary: '#9B9B9B',
      disabled: '#6B6B6B',
    },
    border: {
      default: '#333333',
      strong: '#444444',
    },
    accent: {
      blue: '#4A9EFF',
      green: '#2A9D99',
      orange: '#E5B73B',
      red: '#FF5C5C',
    },
  },
};

export type Colors = typeof colors;
