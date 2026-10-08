import type { Company, CompanyRole } from './order-types';
import { shared } from './mock-store';

/**
 * Mock only: company accounts, in memory. Shared by the order rules (who may approve a company's
 * proofs) and the accounts (who belongs where). One company per email.
 */
export const companies = shared('companies', () => new Map<string, Company>());

export function companyOf(email: string): (Company & { role: CompanyRole }) | null {
  for (const c of companies.values()) {
    const m = c.members.find((x) => x.email === email);
    if (m) return { ...structuredClone(c), role: m.role };
  }
  return null;
}

/** Owners and approvers: the people who approve proofs on the company's orders. */
export const approversOf = (company: Company) => company.members.filter((m) => m.role !== 'member');

export const canApprove = (companyId: string, email: string) => {
  const c = companies.get(companyId);
  return !!c && approversOf(c).some((m) => m.email === email);
};
