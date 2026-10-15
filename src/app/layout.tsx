import type { Metadata, Viewport } from 'next';
import { Barlow_Condensed, Inter } from 'next/font/google';
import './globals.css';

const display = Barlow_Condensed({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-display' });
const body = Inter({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = {
  title: { default: 'Shoku · Meal by meal', template: '%s · Shoku' },
  description: 'Shoku (食, Japanese for a meal) is a food diary for Indian plates: log in seconds and see your day against India’s My Plate guide.',
  applicationName: 'Shoku',
};

export const viewport: Viewport = { themeColor: '#050506', colorScheme: 'dark', viewportFit: 'cover' };

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
