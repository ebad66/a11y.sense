import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'a11y.sense — evidence-backed accessibility analysis',
  description:
    'Scan any live URL and generate a structured WCAG accessibility report with visual evidence, severity framing, and remediation guidance.',
  keywords: [
    'accessibility',
    'a11y',
    'WCAG',
    'audit',
    'inclusive design',
    'frontend testing',
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased" style={{ backgroundColor: '#0b1020', color: '#e5e7eb' }}>
        {children}
      </body>
    </html>
  );
}
