import { ArrowUpRight, RotateCcw } from 'lucide-react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { AddressBook, BrandKitForm, CompanyMembers, CreateCompanyForm, DetailsForm, SignOutButton } from '@/components/account/AccountForms';
import { SignInForm } from '@/components/account/SignInForm';
import { Container } from '@/components/ui/Container';
import { Eyebrow } from '@/components/ui/PrintMarks';
import { emptyBrandKit, MAX_ADDRESSES, SESSION_COOKIE } from '@/lib/account';
import { api } from '@/lib/api';
import { formatKes } from '@/lib/format';
import { CLOSED, localPhone, STATUS_LABEL } from '@/lib/order-status';

export const metadata: Metadata = { title: 'Your account', robots: { index: false, follow: false } };

const when = (iso: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Nairobi' }).format(new Date(iso));

/**
 * The customer's account (docs/ORDER_WORKFLOW_SPEC.md, "Accounts"): every order placed with their
 * phone, the brand kit that fills new briefs, saved addresses, and reorder.
 */
export default async function AccountPage() {
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = session ? await api.getAccount(session) : null;

  if (!account) {
    return (
      <Container className="grid grid-cols-1 gap-10 py-16 sm:py-24 lg:grid-cols-2">
        <div>
          <Eyebrow>Your account</Eyebrow>
          <h1 className="mt-4 text-[clamp(2.25rem,5vw,4rem)] leading-[1] font-extrabold">Sign in with your phone</h1>
          <p className="mt-4 max-w-md text-lg text-body">
            No password: we send a code on WhatsApp. You’ll see every order placed with your number, keep your brand kit for the next brief, and reorder in one tap.
          </p>
        </div>
        <div className="bg-paper p-6 sm:p-8">
          <SignInForm />
        </div>
      </Container>
    );
  }

  const open = account.orders.filter((o) => !CLOSED.includes(o.status));
  return (
    <>
      <Container className="pt-10 pb-8 sm:pt-16">
        <Eyebrow>Your account</Eyebrow>
        <h1 className="mt-4 text-[clamp(2.25rem,5.5vw,4.5rem)] leading-[0.95] font-extrabold tracking-[-0.03em]">
          {account.name ? `Hello, ${account.name.split(' ')[0]}` : 'Your account'}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-body">
          <span>Signed in as {localPhone(account.phone)}</span>
          {account.credit > 0 && (
            <span>
              Credit <strong className="text-heading">{formatKes(account.credit)}</strong>
            </span>
          )}
          <SignOutButton />
        </div>
      </Container>

      <Container className="grid grid-cols-1 gap-14 pb-20 sm:pb-28 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-16">
        <section aria-labelledby="orders-title">
          <h2 id="orders-title" className="text-2xl font-bold">
            Your orders
          </h2>
          <p className="mt-2 text-sm text-body">
            {account.orders.length
              ? `${account.orders.length} order${account.orders.length === 1 ? '' : 's'}, ${open.length} open. Orders placed with your number join your account by themselves.`
              : 'Nothing yet. Orders placed with your number show here.'}
          </p>
          {account.orders.length > 0 && (
            <p className="mt-2">
              <Link href="/account/statement" className="inline-flex min-h-11 items-center text-sm font-semibold text-link underline underline-offset-4">
                Statement of account
              </Link>
            </p>
          )}
          {account.orders.length > 0 ? (
            <ul className="mt-5 flex flex-col border-t border-ink">
              {account.orders.map((o) => (
                <li key={o.ref} className="grid grid-cols-1 gap-3 border-b border-border py-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-baseline gap-x-3">
                      <Link href={`/order/${o.ref}`} className="inline-flex min-h-11 items-center gap-1 font-semibold text-link underline underline-offset-4">
                        {o.productName}
                        <ArrowUpRight aria-hidden className="size-4" />
                      </Link>
                      <span className="text-sm text-muted">
                        {o.ref} · {when(o.createdAt)}
                      </span>
                    </p>
                    <p className="text-sm text-body">
                      <span className="font-semibold text-heading">{STATUS_LABEL[o.status]}</span>
                      {o.mechanism === 'A' && ` · ${o.quantity.toLocaleString('en-KE')} pieces`}
                      {o.total !== null ? ` · paid ${formatKes(o.amountPaid)} of ${formatKes(o.total)}` : ` · paid ${formatKes(o.amountPaid)}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-x-5">
                    <Link href={`/order/${o.ref}/invoice`} className="inline-flex min-h-11 items-center text-sm font-semibold text-link underline underline-offset-4">
                      Invoice {o.invoiceNo}
                    </Link>
                    {o.canReorder && (
                      <Link
                        href={`/order/new?product=${o.productSlug}&reorder=${o.ref}`}
                        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-link underline underline-offset-4"
                      >
                        <RotateCcw aria-hidden className="size-4" />
                        Order again
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Link href="/order" className="mt-5 inline-flex min-h-12 items-center bg-accent px-6 font-semibold text-on-accent transition-colors hover:bg-accent-hover">
              Start an order
            </Link>
          )}
          {account.companyOrders.length > 0 && (
            <div className="mt-12">
              <h3 className="text-xl font-bold">{account.companyAccount?.name}: orders by your colleagues</h3>
              <ul className="mt-4 flex flex-col border-t border-ink">
                {account.companyOrders.map((o) => (
                  <li key={o.ref} className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-border py-3 text-sm">
                    <Link href={`/order/${o.ref}`} className="inline-flex min-h-11 items-center gap-1 font-semibold text-link underline underline-offset-4">
                      {o.productName}
                      <ArrowUpRight aria-hidden className="size-4" />
                    </Link>
                    <span className="text-body">
                      {o.placedBy} · <span className="font-semibold text-heading">{STATUS_LABEL[o.status]}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <div className="flex flex-col gap-14">
          <section aria-labelledby="kit-title">
            <h2 id="kit-title" className="text-2xl font-bold">
              Brand kit
            </h2>
            <p className="mt-2 mb-5 text-sm text-body">Saved once, filled into every new order’s brief.</p>
            <BrandKitForm initial={account.brandKit ?? emptyBrandKit()} />
          </section>
          <section aria-labelledby="addresses-title">
            <h2 id="addresses-title" className="text-2xl font-bold">
              Delivery addresses
            </h2>
            <p className="mt-2 mb-5 text-sm text-body">The first one is filled in when you choose delivery.</p>
            <AddressBook addresses={account.addresses} max={MAX_ADDRESSES} />
          </section>
          <section aria-labelledby="company-title">
            <h2 id="company-title" className="text-2xl font-bold">
              {account.companyAccount ? account.companyAccount.name : 'Ordering for a company?'}
            </h2>
            <p className="mt-2 mb-5 text-sm text-body">
              {account.companyAccount
                ? account.companyAccount.role === 'member'
                  ? 'Your orders go on the company’s invoices; an approver checks their proofs.'
                  : 'Colleagues order with their own phones; owners and approvers approve their proofs. PO numbers go on the invoices.'
                : 'Set up a company account: colleagues order with their own phones, one person approves proofs, and invoices carry your PO numbers.'}
            </p>
            {account.companyAccount ? (
              <CompanyMembers company={account.companyAccount} isOwner={account.companyAccount.role === 'owner'} myPhone={account.phone} />
            ) : (
              <CreateCompanyForm defaultName={account.company} />
            )}
          </section>
          <section aria-labelledby="details-title">
            <h2 id="details-title" className="mb-5 text-2xl font-bold">
              Your details
            </h2>
            <DetailsForm initial={{ name: account.name, email: account.email, company: account.company }} />
          </section>
        </div>
      </Container>
    </>
  );
}
