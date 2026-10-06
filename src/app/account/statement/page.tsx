import { Download } from 'lucide-react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { BrandDocument, DocLabel, IssuerBlock, money } from '@/components/order/BrandDocument';
import { SESSION_COOKIE } from '@/lib/account';
import { api } from '@/lib/api';
import { formatDateShort } from '@/lib/calendar';
import { localPhone } from '@/lib/order-status';
import { nairobiToday } from '@/lib/quote';

export const metadata: Metadata = { title: 'Statement of account', robots: { index: false, follow: false } };

const day = (iso: string) => formatDateShort(nairobiToday(new Date(iso)));

/** Every invoice and payment on the account, with a running balance; printable, and as CSV. */
export default async function StatementPage() {
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = session ? await api.getAccount(session) : null;
  if (!session || !account) redirect('/account');
  const statement = await api.getStatement(session);
  const today = nairobiToday();

  return (
    <BrandDocument
      backHref="/account"
      backLabel="Back to your account"
      label="Statement of account"
      title="STATEMENT"
      number={`${account.phone.slice(-6)}-${today.replace(/-/g, '')}`}
      highlight={{ label: statement.balance < 0 ? 'In credit' : 'Balance due', value: `KES ${money(Math.abs(statement.balance))}` }}
    >
      <div className="grid grid-cols-1 gap-6 py-6 sm:grid-cols-3">
        <IssuerBlock />
        <div>
          <DocLabel>Statement for</DocLabel>
          <p className="mt-2 text-base font-bold text-heading">{account.company || account.name}</p>
          {account.company && <p className="text-muted">{account.name}</p>}
          <p className="text-muted">{localPhone(account.phone)}</p>
          <p className="break-all text-muted">{account.email}</p>
        </div>
        <div>
          <DocLabel>Details</DocLabel>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted">Date</dt>
            <dd className="text-right font-medium text-heading">{formatDateShort(today)}</dd>
            <dt className="text-muted">Invoiced</dt>
            <dd className="text-right font-medium text-heading tabular-nums">{money(statement.invoiced)}</dd>
            <dt className="text-muted">Paid</dt>
            <dd className="text-right font-medium text-heading tabular-nums">{money(statement.paid)}</dd>
          </dl>
          <a
            href="/account/statement.csv"
            download
            className="mt-3 inline-flex min-h-11 items-center gap-2 font-semibold text-link underline underline-offset-4 print:hidden"
          >
            <Download aria-hidden className="size-4" /> Download as CSV
          </a>
        </div>
      </div>

      {statement.lines.length ? (
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Statement lines">
          <table className="w-full min-w-[34rem] border-b border-ink text-left">
            <thead>
              <tr className="bg-ink text-xs text-bg uppercase">
                <th scope="col" className="px-3 py-3 font-medium">Date</th>
                <th scope="col" className="px-2 py-3 font-medium">Document</th>
                <th scope="col" className="px-2 py-3 text-right font-medium">Debit</th>
                <th scope="col" className="px-2 py-3 text-right font-medium">Credit</th>
                <th scope="col" className="px-3 py-3 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {statement.lines.map((l, i) => (
                <tr key={`${l.document}-${i}`} className="border-b border-border align-top">
                  <td className="px-3 py-2.5 whitespace-nowrap text-heading">{day(l.date)}</td>
                  <td className="px-2 py-2.5">
                    <p className="text-heading">
                      {l.document} · {l.ref}
                    </p>
                    <p className="text-muted">{l.description}</p>
                  </td>
                  <td className="px-2 py-2.5 text-right text-heading tabular-nums">{l.debit ? money(l.debit) : ''}</td>
                  <td className="px-2 py-2.5 text-right text-heading tabular-nums">{l.credit ? money(l.credit) : ''}</td>
                  <td className="px-3 py-2.5 text-right font-medium text-heading tabular-nums">{money(l.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="py-6 text-heading">No invoices or payments yet.</p>
      )}
    </BrandDocument>
  );
}
