import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { ServiceWorker } from '@/components/ServiceWorker';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Laponie', template: '%s · Laponie' },
  description: 'Budget cadeaux partagé pour les événements en famille.',
  applicationName: 'Laponie',
  appleWebApp: { capable: true, title: 'Laponie', statusBarStyle: 'default' },
  icons: {
    icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#1F6B52',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={inter.variable}>
      <body className="font-sans">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
