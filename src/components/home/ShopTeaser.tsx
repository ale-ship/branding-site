import type { Product } from '@/lib/api';
import { ProductCard } from '../shop/ProductCard';
import { Container } from '../ui/Container';
import { Reveal } from '../ui/Reveal';
import { SectionHeading } from './SectionHeading';

type Props = {
  products: Product[];
  title?: string;
  intro?: string;
};

/** Shop items priced per piece. The shop is add-to-quote only (no payment). */
export function ShopTeaser({
  products,
  title = 'Ready to brand',
  intro = 'Priced per piece. Pick what you need, add it to a quote, and we’ll send a proof before anything is printed.',
}: Props) {
  if (!products.length) return null;
  return (
    <section aria-labelledby="shop-title" className="py-20 sm:py-32">
      <Container>
        <SectionHeading id="shop-title" eyebrow="Shop" title={title} intro={intro} link={{ href: '/shop', label: 'Browse the shop' }} />
        <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
          {products.map((product, i) => (
            <Reveal as="li" key={product.slug} delay={i * 80}>
              <ProductCard product={product} />
            </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  );
}
