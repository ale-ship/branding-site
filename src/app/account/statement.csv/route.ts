import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/lib/account';
import { api } from '@/lib/api';
import { nairobiToday } from '@/lib/quote';
import { statementCsv } from '@/lib/statement';

/** The statement of account as a CSV download, for the signed-in customer only. */
export async function GET() {
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = session ? await api.getAccount(session) : null;
  if (!session || !account) return new Response('Please sign in again.', { status: 401, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  const csv = statementCsv(await api.getStatement(session));
  return new Response(`﻿${csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="noorcom-statement-${nairobiToday()}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
