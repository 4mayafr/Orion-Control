import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'ORION CONTROL · Operations Platform',
    template: '%s · ORION CONTROL',
  },
  description:
    'ORION CONTROL is a game community operations and monitoring platform: server statistics, background tasks, Discord integration, operators and audit history.',
  applicationName: 'ORION CONTROL',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#04060d',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
