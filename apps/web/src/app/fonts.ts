import { Geist, Geist_Mono } from 'next/font/google';

// Shared by both root layouts, (demo) and (internal), so the two builds render
// the same type. Same family the design-system showcase loads via
// @fontsource-variable/geist; `--font-sans` is what globals.css maps into
// Tailwind's `font-sans`.
export const geistSans = Geist({
  variable: '--font-sans',
  subsets: ['latin'],
});

export const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});
