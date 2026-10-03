import { ArrowLeft, MessageCircle } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { QuoteCta } from '@/components/home/QuoteCta';
import { ShopTeaser } from '@/components/home/ShopTeaser';
import { AddToQuote } from '@/components/shop/AddToQuote';
import { Container } from '@/components/ui/Container';
import { CropMarks } from '@/components/ui/PrintMarks';
import { api } from '@/lib/api';
import { formatKes } from '@/lib/format';
import { serviceHref } from '@/lib/services';
import { categoryLabel, productHref, relatedProducts, shopHref } from '@/lib/shop';
import { site } from '@/lib/site';

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await api.listProducts()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await api.getProduct((await params).slug);
  if (!product) return {};
  const description = `${product.summary} ${formatKes(product.pricePerPiece)} per piece, from ${product.minQuantity} pieces.`;
  return {
    title: product.name,
    description,
    alternates: { canonical: productHref(product.slug) },
    openGraph: { title: product.name, description, images: [{ url: product.image.src, alt: product.image.alt }] },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [product, products, services] = await Promise.all([api.getProduct(slug), api.listProducts(), api.listServices()]);
  if (!product) notFound();
  const service = services.find((s) => s.slug === product.service);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: new URL(product.image.src, site.url).toString(),
    brand: { '@type': 'Brand', name: site.name },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'KES',
      price: product.pricePerPiece,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: product.pricePerPiece,
        priceCurrency: 'KES',
        unitText: 'piece',
      },
      eligibleQuantity: { '@type': 'QuantitativeValue', minValue: product.minQuantity, unitText: 'piece' },
      availability: 'https://schema.org/InStock',
      seller: { '@type': 'Organization', name: site.name },
    },
  };

  const whatsappText = encodeURIComponent(`Hello Noorcom, I have a question about ${product.name}.`);
  const details = [
    { label: 'Price', value: `${formatKes(product.pricePerPiece)} per piece` },
    { label: 'Minimum order', value: `${product.minQuantity} pieces` },
    ...(service ? [{ label: 'Turnaround', value: `${service.turnaround} after you approve the proof` }] : []),
    { label: 'Proof', value: 'A free digital proof before anything is printed' },
    { label: 'Collection or delivery', value: 'Collect on Loita Street, or delivery across Kenya' },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      <Container className="pt-8 sm:pt-12">
        <Link href="/shop" className="group inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-heading">
          <ArrowLeft aria-hidden className="size-4 transition-transform group-hover:-translate-x-1" />
          All products
        </Link>
      </Container>

      <Container className="grid grid-cols-1 gap-10 pt-6 pb-20 sm:pt-8 sm:pb-28 lg:grid-cols-2 lg:gap-16">
        <div className="relative self-start lg:sticky lg:top-28">
          <div className="relative aspect-square overflow-hidden bg-panel">
            <Image src={product.image.src} alt={product.image.alt} fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
          </div>
          <CropMarks />
        </div>

        <div>
          <Link
            href={shopHref(product.category)}
            className="inline-flex min-h-11 items-center text-xs font-semibold tracking-[0.18em] text-muted uppercase hover:text-heading"
          >
            {categoryLabel(product.category)}
          </Link>
          <h1 className="mt-2 text-[clamp(2.5rem,5vw,4.5rem)] leading-[0.95] font-extrabold tracking-[-0.035em]">{product.name}</h1>
          <p className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-display text-3xl font-bold text-heading">{formatKes(product.pricePerPiece)}</span>
            <span className="text-muted">per piece · minimum {product.minQuantity}</span>
          </p>
          <p className="mt-6 text-lg text-body">{product.description}</p>

          <div className="mt-10 border-t border-border pt-8">
            <AddToQuote
              slug={product.slug}
              name={product.name}
              pricePerPiece={product.pricePerPiece}
              minQuantity={product.minQuantity}
              options={product.options}
            />
          </div>

          <a
            href={`${site.whatsappHref}?text=${whatsappText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex min-h-11 items-center gap-2 font-semibold text-heading underline decoration-border-strong underline-offset-4 hover:decoration-ink"
          >
            <MessageCircle aria-hidden className="size-4" />
            Ask about this on WhatsApp
          </a>

          <dl className="mt-10 border-t border-ink">
            {details.map((d) => (
              <div key={d.label} className="grid grid-cols-1 gap-1 border-b border-border py-4 sm:grid-cols-[11rem_1fr] sm:gap-6">
                <dt className="text-sm font-semibold text-muted">{d.label}</dt>
                <dd className="text-heading">{d.value}</dd>
              </div>
            ))}
          </dl>

          {service && (
            <p className="mt-6 text-body">
              Made by our{' '}
              <Link href={serviceHref(service.slug)} className="font-semibold text-link underline underline-offset-4">
                {service.name.toLowerCase()}
              </Link>{' '}
              team in our Nairobi workshop.
            </p>
          )}
        </div>
      </Container>

      <ShopTeaser products={relatedProducts(product, products)} title="You might also need" intro="Often ordered together." />
      <QuoteCta />
    </>
  );
}
