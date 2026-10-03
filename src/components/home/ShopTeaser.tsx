import Image from 'next/image';
import Link from 'next/link';
import type { Product } from '@/lib/api';
import { formatKes } from '@/lib/format';
import { Container } from '../ui/Container';
import { Reveal } from '../ui/Reveal';
import { SectionHeading } from './SectionHeading';

/** Popular items, priced per piece. The shop is add-to-quote only (no payment). */
export function ShopTeaser({ products }: { products: Product[] }) {
  return (
    <section aria-labelledby="shop-title" className="py-20 sm:py-32">
      <Container>
        <SectionHeading
          id="shop-title"
          eyebrow="Shop"
          title="Ready to brand"
          intro="Priced per piece. Pick what you need, add it to a quote, and we’ll send a proof before anything is printed."
          link={{ href: '/shop', label: 'Browse the shop' }}
        />
        <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
          {products.map((product, i) => (
            <Reveal as="li" key={product.slug} delay={i * 80}>
              <Link href={`/shop/${product.slug}`} className="group block">
                <div className="relative aspect-square overflow-hidden bg-panel">
                  <Image
                    src={product.image.src}
                    alt={product.image.alt}
                    fill
                    sizes="(min-width: 1024px) 25vw, 50vw"
                    className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.05]"
                  />
                </div>
                <h3 className="mt-4 font-sans text-base font-semibold text-heading sm:text-lg">{product.name}</h3>
                <p className="mt-1 text-body">
                  <span className="font-semibold text-heading">{formatKes(product.pricePerPiece)}</span>
                  <span className="text-muted"> / piece</span>
                </p>
                <p className="mt-1 text-sm text-muted">Min. {product.minQuantity} pieces</p>
              </Link>
            </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  );
}
