'use server';

import { cookies } from 'next/headers';
import { coerceAddress, coerceBrandKit, isCode, normaliseEmail, SESSION_COOKIE, SESSION_DAYS } from '@/lib/account';
import { api, apiMode, OrderError } from '@/lib/api';

/**
 * Accounts, server side (docs/ORDER_WORKFLOW_SPEC.md, "Accounts"). The session lives in an httpOnly
 * cookie; everything from the browser is cleaned and checked again here and by the API.
 */

type Fail = { ok: false; message: string; errors?: Record<string, string> };
type Done = { ok: true };

const COOKIE_OPTIONS = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * SESSION_DAYS };

const failure = (e: unknown, fallback: string): Fail => (e instanceof OrderError ? { ok: false, message: e.message } : { ok: false, message: fallback });

async function session(): Promise<string> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!value) throw new OrderError('not_found', 'Please sign in again.');
  return value;
}

const ENTER_EMAIL = 'Enter your email address, like you@company.co.ke.';

export async function requestCodeAction(email: unknown): Promise<{ ok: true; sentTo: string; demoCode?: string } | Fail> {
  const address = normaliseEmail(email);
  if (!address) return { ok: false, message: ENTER_EMAIL };
  try {
    const sent = await api.requestSignInCode(address);
    // The mock hands the code back so the flow can be tried; the live API never does.
    return { ok: true, sentTo: sent.sentTo, ...(apiMode === 'mock' && sent.demoCode ? { demoCode: sent.demoCode } : {}) };
  } catch (e) {
    return failure(e, 'We couldn’t send a code just now. Please try again.');
  }
}

export async function verifyCodeAction(email: unknown, code: unknown): Promise<Done | Fail> {
  const address = normaliseEmail(email);
  const c = String(code ?? '').trim();
  if (!address) return { ok: false, message: ENTER_EMAIL };
  if (!isCode(c)) return { ok: false, message: 'Enter the six-digit code from the email.' };
  try {
    const { session: value } = await api.verifySignInCode(address, c);
    (await cookies()).set(SESSION_COOKIE, value, COOKIE_OPTIONS);
    return { ok: true };
  } catch (e) {
    return failure(e, 'We couldn’t sign you in just now. Please try again.');
  }
}

export async function signOutAction(): Promise<Done> {
  const jar = await cookies();
  const value = jar.get(SESSION_COOKIE)?.value;
  if (value) await api.signOut(value).catch(() => undefined);
  jar.delete(SESSION_COOKIE);
  return { ok: true };
}

export async function updateDetailsAction(raw: unknown): Promise<Done | Fail> {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === 'string' ? v : '');
  try {
    await api.updateAccount(await session(), { name: s(r.name), phone: s(r.phone), company: s(r.company) });
    return { ok: true };
  } catch (e) {
    return failure(e, 'We couldn’t save that. Please try again.');
  }
}

export async function saveBrandKitAction(raw: unknown): Promise<Done | Fail> {
  const { kit, errors } = coerceBrandKit(raw);
  if (Object.keys(errors).length) return { ok: false, message: 'Some details need another look.', errors };
  try {
    await api.saveBrandKit(await session(), kit);
    return { ok: true };
  } catch (e) {
    return failure(e, 'We couldn’t save your brand kit. Please try again.');
  }
}

export async function saveAddressAction(raw: unknown): Promise<Done | Fail> {
  const { address, error } = coerceAddress(raw);
  if (error) return { ok: false, message: error };
  try {
    await api.saveAddress(await session(), address);
    return { ok: true };
  } catch (e) {
    return failure(e, 'We couldn’t save that address. Please try again.');
  }
}

export async function removeAddressAction(id: unknown): Promise<Done | Fail> {
  try {
    await api.removeAddress(await session(), String(id ?? ''));
    return { ok: true };
  } catch (e) {
    return failure(e, 'We couldn’t remove that address. Please try again.');
  }
}

export async function createCompanyAction(raw: unknown): Promise<Done | Fail> {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  try {
    await api.createCompany(await session(), { name: String(r.name ?? ''), kraPin: String(r.kraPin ?? '') });
    return { ok: true };
  } catch (e) {
    return failure(e, 'We couldn’t set up the company. Please try again.');
  }
}

export async function addMemberAction(raw: unknown): Promise<Done | Fail> {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const email = normaliseEmail(r.email);
  if (!email) return { ok: false, message: 'Enter their email address, like name@company.co.ke.' };
  try {
    await api.addCompanyMember(await session(), { email, name: String(r.name ?? ''), role: r.role === 'approver' ? 'approver' : 'member' });
    return { ok: true };
  } catch (e) {
    return failure(e, 'We couldn’t add them. Please try again.');
  }
}

export async function removeMemberAction(email: unknown): Promise<Done | Fail> {
  try {
    await api.removeCompanyMember(await session(), String(email ?? ''));
    return { ok: true };
  } catch (e) {
    return failure(e, 'We couldn’t remove them. Please try again.');
  }
}
