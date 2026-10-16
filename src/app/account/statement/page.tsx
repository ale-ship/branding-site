import { Download } from 'lucide-react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { BrandDocument, DocMeta, DocParties, money, PartyBlock, Th } from '@/components/order/BrandDocument';
import { SESSION_COOKIE } from '@/lib/account';
import { api } from '@/lib/api';
import { formatDateShort } from '@/lib/calendar';
import { localPhone } from '@/lib/order-status';
import { nairobiToday } from '@/lib/quote';

export const metadata: Metadata = {
  title: 'Statement of account',
  robots: { index: false, follow: false },
};

const day = (iso: string) => formatDateShort(nairobiToday(new Date(iso)));

/** Every invoice and payment on the account, with a running balance; printable, and as CSV. */
/** A short, stable number for the customer on their statements, from the account's email. */
function customerNo(email: string): string {
  let h = 5381;
  for (const ch of email) h = (h * 33 + ch.charCodeAt(0)) % 1_000_000;
  return String(h).padStart(6, '0');
}

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
      number={`${customerNo(account.email)}-${today.replace(/-/g, '')}`}
      highlight={{
        label: statement.balance < 0 ? 'In credit' : 'Balance due',
        value: `KES ${money(Math.abs(statement.balance))}`,
      }}
    >
      <DocParties>
        <PartyBlock
          label="Statement for"
          name={account.company || account.name}
          lines={[account.company && account.name, account.email, account.phone && localPhone(account.phone)]}
        />
        <DocMeta
          rows={[
            ['Date', formatDateShort(today)],
            ['Invoiced', money(statement.invoiced)],
            ['Paid', money(statement.paid)],
          ]}
        >
          <a href="/account/statement.csv" download className="mt-3 inline-flex min-h-11 items-center gap-2 font-semibold text-link underline underline-offset-4 print:hidden">
            <Download aria-hidden className="size-4" /> Download as CSV
          </a>
        </DocMeta>
      </DocParties>

      {statement.lines.length ? (
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Statement lines">
          <table className="w-full min-w-[34rem] text-left">
            <thead>
              <tr className="bg-ink-hover text-xs text-bg uppercase">
                <Th>Date</Th>
                <Th>Document</Th>
                <Th align="right">Debit</Th>
                <Th align="right">Credit</Th>
                <Th align="right" last>
                  Balance
                </Th>
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
