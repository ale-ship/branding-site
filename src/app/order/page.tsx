import { ArrowUpRight } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { OrderLookup } from '@/components/order/OrderLookup';
import { Container } from '@/components/ui/Container';
import { Eyebrow } from '@/components/ui/PrintMarks';
import { PageHeader } from '@/components/ui/PageHeader';
import { Reveal } from '@/components/ui/Reveal';
import { api, type Mechanism } from '@/lib/api';
import { formatKes } from '@/lib/format';
import { unitPriceFor } from '@/lib/pricing';

export const metadata: Metadata = {
  title: 'Order online',
  description: 'Order printing, branding and design online: a live price, an M-Pesa deposit, a proof to approve, and tracking to your door.',
  alternates: { canonical: '/order' },
};

const MECHANISM_TAG: Record<Mechanism, string> = {
  A: 'Priced instantly',
  B: 'Survey first',
  C: 'Design files',
};

export default async function OrderPage() {
  const [categories, products] = await Promise.all([api.listOrderCategories(), api.listOrderProducts()]);
  return (
    <>
      <PageHeader
        eyebrow="Order online"
        title="What would you like made?"
        intro="Pick an item, tell us about it and see the price straight away. Pay a deposit by M-Pesa, approve a proof, and follow your order until it’s in your hands."
      />

      <Container className="flex flex-col gap-16 pb-20 sm:gap-20 sm:pb-28">
        {categories.map((category) => {
          const items = products.filter((p) => p.category === category.slug);
          return (
            <section key={category.slug} aria-labelledby={`cat-${category.slug}`}>
              <Reveal className="mb-6 flex flex-wrap items-baseline justify-between gap-3 border-b border-ink pb-3">
                <h2 id={`cat-${category.slug}`} className="text-[clamp(1.6rem,3vw,2.4rem)] leading-tight font-bold">
                  {category.name}
                </h2>
                <p className="flex items-center gap-3 text-sm text-muted">
                  <span className="border border-border-strong px-2 py-0.5 text-xs font-semibold tracking-[0.12em] text-heading uppercase">{MECHANISM_TAG[category.mechanism]}</span>
                  <span className="hidden sm:inline">{category.summary}</span>
                </p>
              </Reveal>
              <ul className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
                {items.map((p, i) => (
                  <Reveal as="li" key={p.slug} delay={(i % 4) * 70}>
                    <Link href={`/order/new?product=${p.slug}`} className="group block">
                      <div className="relative aspect-[4/3] overflow-hidden bg-panel">
                        <Image src={p.image.src} alt={p.image.alt} fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.04]" />
                      </div>
                      <h3 className="mt-4 flex items-start justify-between gap-3 font-sans text-lg font-semibold tracking-normal text-heading">
                        {p.name}
                        <ArrowUpRight aria-hidden className="mt-1 size-4 shrink-0 transition-transform group-hover:rotate-45" />
                      </h3>
                      <p className="mt-1 text-sm text-body">{p.summary}</p>
                      <p className="mt-2 text-sm font-semibold text-heading">
                        {p.mechanism === 'A' && `From ${formatKes(unitPriceFor(p.priceTiers, Number.MAX_SAFE_INTEGER))} each · min. ${p.minQuantity}`}
                        {p.mechanism === 'B' && `Survey ${formatKes(p.surveyFee)}, credited to your bill`}
                        {p.mechanism === 'C' && `${formatKes(p.packagePrice)} · ${p.revisionRounds} revision rounds`}
                      </p>
                    </Link>
                  </Reveal>
                ))}
              </ul>
            </section>
          );
        })}

        <section aria-labelledby="find-order" className="grid grid-cols-1 gap-8 bg-paper p-6 sm:p-10 lg:grid-cols-2">
          <div>
            <Eyebrow>Already ordered?</Eyebrow>
            <h2 id="find-order" className="mt-3 text-[clamp(1.6rem,3vw,2.4rem)] leading-tight font-bold">
              Find your order
            </h2>
            <p className="mt-3 text-body">Your order number is in the WhatsApp message and email we sent. Not sure what you need? <Link href="/quote" className="font-semibold text-link underline">Ask us for a quote</Link> instead.</p>
            <p className="mt-3 text-body">
              Order often? <Link href="/account" className="font-semibold text-link underline">Sign in with your phone</Link> to see every order, save your brand kit and reorder in one tap.
            </p>
          </div>
          <OrderLookup />
        </section>
      </Container>
    </>
  );
}
