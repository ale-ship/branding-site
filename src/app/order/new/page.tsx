import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { OrderForm } from '@/components/order/OrderForm';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { SESSION_COOKIE } from '@/lib/account';
import { api, type Account, type OrderProduct, type ReorderDraft } from '@/lib/api';
import { draftBriefFrom, emptyOrderDraft, type OrderDraft } from '@/lib/order';
import { localPhone } from '@/lib/order-status';

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

/**
 * The starting draft for a signed-in customer: their details, brand kit and first address, and for a
 * reorder the past order's choices with its approved artwork. Only a convenience: the server checks
 * and prices everything again when the order is placed.
 */
function startingDraft(product: OrderProduct, account: Account, reorder: ReorderDraft | null): OrderDraft {
  const d = emptyOrderDraft(product);
  d.name = account.name;
  d.company = account.company;
  d.email = account.email;
  d.phone = account.phone ? localPhone(account.phone) : '';
  const kit = account.brandKit;
  if (kit) {
    d.common = { ...d.common, colours: kit.colours, typography: kit.typography, fonts: kit.fonts, assets: kit.logos, notes: kit.notes };
  }
  const address = account.addresses[0];
  if (address && product.mechanism === 'A') {
    d.zone = address.zone;
    d.address = address.address;
  }
  if (reorder && reorder.product === product.slug) {
    if (product.mechanism === 'A') d.quantity = String(reorder.quantity);
    d.brief = draftBriefFrom(product, reorder.brief);
    d.common = structuredClone(reorder.common);
    if (reorder.handover.method === 'delivery') {
      d.handover = 'delivery';
      d.zone = reorder.handover.zone;
      d.address = reorder.handover.address;
    }
  }
  return d;
}

export default async function NewOrderPage({ searchParams }: Props) {
  const params = await searchParams;
  const product = await api.getOrderProduct(first(params.product) ?? '');
  if (!product) redirect('/order');
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = session ? await api.getAccount(session) : null;
  const reorderRef = first(params.reorder);
  const reorder = account && session && reorderRef ? await api.reorderDraft(session, reorderRef).catch(() => null) : null;
  const initial = account ? startingDraft(product, account, reorder) : undefined;
  const calendar = await api.getCapacity();

  return (
    <>
      <PageHeader eyebrow="Order online" title={product.name} intro={product.summary} />
      <Container className="pb-20 sm:pb-28">
        {reorder && (
          <p className="mb-8 border-l-4 border-accent bg-paper px-4 py-3 text-heading">
            Ordering again from {reorder.from}: the same choices and the approved artwork, with no design fee. Change anything you like.
          </p>
        )}
        {account && !reorder && account.brandKit && <p className="mb-8 text-sm text-muted">Your brand kit and details are filled in from your account.</p>}
        <OrderForm product={product} prefill={prefillFrom(params, product)} initial={initial} calendar={calendar} companyName={account?.companyAccount?.name} />
      </Container>
    </>
  );
}
