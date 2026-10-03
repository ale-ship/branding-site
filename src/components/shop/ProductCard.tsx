import Image from 'next/image';
import Link from 'next/link';
import type { Product } from '@/lib/api';
import { formatKes } from '@/lib/format';
import { productHref } from '@/lib/shop';

/** A shop item: photo on a grey well, name, price per piece and the minimum order. */
export function ProductCard({ product, as: Heading = 'h3' }: { product: Product; as?: 'h2' | 'h3' }) {
  return (
    <Link href={productHref(product.slug)} className="group block">
      <div className="relative aspect-square overflow-hidden bg-panel">
        <Image
          src={product.image.src}
          alt={product.image.alt}
          fill
          sizes="(min-width: 1024px) 25vw, 50vw"
          className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.05]"
        />
      </div>
      <Heading className="mt-4 font-sans text-base font-semibold tracking-normal text-heading sm:text-lg">{product.name}</Heading>
      <p className="mt-1 text-body">
        <span className="font-semibold text-heading">{formatKes(product.pricePerPiece)}</span>
        <span className="text-muted"> / piece</span>
      </p>
      <p className="mt-1 text-sm text-muted">Min. {product.minQuantity} pieces</p>
    </Link>
  );
}
