// Mirrors web/src/App.css :root tokens (light + dark) so the app and site read
// as one brand. Serif display face approximates the web's Iowan/Palatino stack
// with fonts that ship on-device.
import { Platform } from 'react-native';

export interface Theme {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accentInk: string;
  accentWeak: string;
  border: string;
  borderStrong: string;
  danger: string;
  radius: number;
  radiusSm: number;
  serif: string;
}

const light: Theme = {
  bg: '#faf9fd',
  surface: '#ffffff',
  text: '#15131f',
  muted: '#5d5a72',
  accent: '#7c3aed',
  accentInk: '#ffffff',
  accentWeak: 'rgba(124, 58, 237, 0.09)',
  border: 'rgba(20, 18, 45, 0.11)',
  borderStrong: 'rgba(20, 18, 45, 0.2)',
  danger: '#dc2626',
  radius: 14,
  radiusSm: 10,
  serif: Platform.select({ ios: 'Iowan Old Style', default: 'serif' }) as string,
};

const dark: Theme = {
  ...light,
  bg: '#0b0a12',
  surface: '#15131f',
  text: '#eceaf5',
  muted: '#a3a0b8',
  accent: '#8b5cf6',
  accentWeak: 'rgba(167, 139, 250, 0.12)',
  border: 'rgba(255, 255, 255, 0.1)',
  borderStrong: 'rgba(255, 255, 255, 0.19)',
  danger: '#f87171',
};

export const palette = (scheme: string | null | undefined): Theme =>
  scheme === 'dark' ? dark : light;
