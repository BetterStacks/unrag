import type { ReactNode } from 'react';
import { Instrument_Serif, Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-unrag-sans',
  display: 'swap',
});

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-unrag-display',
  display: 'swap',
});

export default function InstallLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`unrag-theme ${inter.variable} ${instrumentSerif.variable}`}>
      {children}
    </div>
  );
}
