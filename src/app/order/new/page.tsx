import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { OrderForm } from '@/components/order/OrderForm';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { api, type OrderProduct } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Place an order',
  robots: { index: false, follow: true },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Choices carried over from a shop page (`?qty=120&opt=Finish:Gloss laminate`): each `opt` value is
 * matched to the brief's select fields by option label. Anything that doesn't match is ignored.
 */
function prefillFrom(params: Record<string, string | string[] | undefined>, product: OrderProduct) {
  const qty = first(params.qty);
  const opts = ([] as string[]).concat(params.opt ?? []).map((o) => o.split(':').slice(1).join(':').trim().toLowerCase());
  const brief: Record<string, string> = {};
  for (const f of product.brief) {
    if (f.kind !== 'select') continue;
    const match = f.options.find((o) => opts.includes(o.label.toLowerCase()));
    if (match) brief[f.id] = match.value;
  }
  return { quantity: qty && /^\d{1,6}$/.test(qty) ? qty : undefined, brief };
}

export default async function NewOrderPage({ searchParams }: Props) {
  const params = await searchParams;
  const product = await api.getOrderProduct(first(params.product) ?? '');
  if (!product) redirect('/order');

  return (
    <>
      <PageHeader eyebrow="Order online" title={product.name} intro={product.summary} />
      <Container className="pb-20 sm:pb-28">
        <OrderForm product={product} prefill={prefillFrom(params, product)} />
      </Container>
    </>
  );
}
