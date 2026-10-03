import type { Metadata } from 'next';
import Link from 'next/link';
import { QuoteCta } from '@/components/home/QuoteCta';
import { ProductCard } from '@/components/shop/ProductCard';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { Reveal } from '@/components/ui/Reveal';
import { api } from '@/lib/api';
import { categoryCounts, parseCategory, shopHref } from '@/lib/shop';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const description =
  'Branded business cards, posters, notebooks, mugs, bottles, umbrellas, t-shirts, hoodies, gift bags and banner stands, priced per piece.';

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const category = parseCategory((await searchParams).category);
  return {
    title: 'Shop',
    description,
    alternates: { canonical: '/shop' },
    robots: category ? { index: false, follow: true } : undefined,
  };
}

const chip = 'inline-flex min-h-11 shrink-0 items-center gap-2 border px-4 text-sm font-medium whitespace-nowrap transition-colors';

export default async function ShopPage({ searchParams }: Props) {
  const [params, products] = await Promise.all([searchParams, api.listProducts()]);
  const category = parseCategory(params.category);
  const shown = category ? products.filter((p) => p.category === category) : products;
  const counts = categoryCounts(products);

  return (
    <>
      <PageHeader
        eyebrow="Shop"
        title="Ready to brand"
        intro="Everyday items with your logo on them, priced per piece. Add what you need to a quote: we’ll confirm the price and send a proof before anything is printed."
      >
        <nav aria-label="Shop categories" className="mt-10 border-t border-border pt-6 sm:mt-12">
          <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            <li>
              <Link
                href={shopHref()}
                aria-current={!category ? 'true' : undefined}
                className={`${chip} ${!category ? 'border-ink bg-ink text-bg' : 'border-border-strong text-heading hover:border-ink'}`}
              >
                All <span className={!category ? 'text-bg/70' : 'text-muted'}>{products.length}</span>
              </Link>
            </li>
            {counts.map((c) => {
              const active = c.value === category;
              return (
                <li key={c.value}>
                  <Link
                    href={active ? shopHref() : shopHref(c.value)}
                    aria-current={active ? 'true' : undefined}
                    className={`${chip} ${active ? 'border-ink bg-ink text-bg' : 'border-border-strong text-heading hover:border-ink'}`}
                  >
                    {c.label} <span className={active ? 'text-bg/70' : 'text-muted'}>{c.count}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </PageHeader>

      <Container className="pb-20 sm:pb-28">
        <p aria-live="polite" className="mb-8 flex flex-wrap justify-between gap-2 border-b border-border pb-4 text-sm text-muted">
          <span>{shown.length === 1 ? '1 item' : `${shown.length} items`}</span>
          <span>Prices per piece, before design and delivery</span>
        </p>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
          {shown.map((product, i) => (
            <Reveal as="li" key={product.slug} delay={(i % 4) * 70}>
              <ProductCard product={product} as="h2" />
            </Reveal>
          ))}
        </ul>

        <div className="mt-20 grid grid-cols-1 gap-6 bg-paper p-6 sm:mt-28 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h2 className="text-[clamp(1.6rem,3vw,2.25rem)] leading-tight font-bold">Need something that isn’t here?</h2>
            <p className="mt-2 max-w-xl text-body">
              Signs, vehicle wraps, murals and anything custom go through our services. Tell us what you need.
            </p>
          </div>
          <Link
            href="/services"
            className="inline-flex min-h-12 items-center justify-center border border-ink px-6 font-semibold text-ink transition-colors hover:bg-ink hover:text-bg"
          >
            See our services
          </Link>
        </div>
      </Container>

      <QuoteCta />
    </>
  );
}
