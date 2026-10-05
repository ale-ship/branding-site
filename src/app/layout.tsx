import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Inter } from 'next/font/google';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { WhatsAppButton } from '@/components/layout/WhatsAppButton';
import { RevealObserver } from '@/components/ui/RevealObserver';
import { site } from '@/lib/site';
import './globals.css';

// Downloaded at build time and served from our own domain: no requests to Google at runtime.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name}: printing and branding in Nairobi`, template: `%s | ${site.name}` },
  description: site.description,
  openGraph: { type: 'website', siteName: site.name, locale: 'en_KE' },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = { themeColor: '#ffffff' };

/** Who we are and where, for search engines. Same premises as Noorcom Computers. */
const businessJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: site.name,
  description: site.description,
  url: site.url,
  telephone: site.phone.replace(/\s/g, ''),
  email: site.email,
  address: { '@type': 'PostalAddress', ...site.postalAddress },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-KE" className={`${inter.variable} ${bricolage.variable}`} suppressHydrationWarning>
      <head>
        {/* Marks JavaScript as available so scroll reveals start hidden; without it content just shows. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="fixed top-3 left-3 z-50 inline-flex min-h-11 -translate-y-24 items-center bg-ink px-4 text-bg focus:translate-y-0 print:hidden"
        >
          Skip to content
        </a>
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
        <WhatsAppButton />
        <RevealObserver />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(businessJsonLd).replace(/</g, '\\u003c') }}
        />
      </body>
    </html>
  );
}
