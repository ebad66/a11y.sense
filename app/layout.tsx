import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'a11y.sense',
  description:
    'Audit any webpage for accessibility issues across 5 disability profiles using AI-powered analysis.',
  keywords: ['accessibility', 'a11y', 'WCAG', 'audit', 'disability', 'inclusion'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="min-h-screen antialiased"
        style={{ backgroundColor: '#0f0f1a', color: '#e5e7eb' }}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
