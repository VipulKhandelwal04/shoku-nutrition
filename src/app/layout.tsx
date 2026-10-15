import type { Metadata, Viewport } from 'next';
import { Barlow_Condensed, Inter } from 'next/font/google';
import './globals.css';

const display = Barlow_Condensed({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-display' });
const body = Inter({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = {
  title: { default: 'Katori · Eat like you train', template: '%s · Katori' },
  description: 'Katori is a nutrition tracker built for Indian plates: log in seconds, snap your meal, and see your plate against India’s My Plate guide.',
  applicationName: 'Katori',
};

export const viewport: Viewport = { themeColor: '#050506', colorScheme: 'dark', viewportFit: 'cover' };

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
