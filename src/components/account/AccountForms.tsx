'use client';

import { LogOut, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { addMemberAction, createCompanyAction, removeAddressAction, removeMemberAction, saveAddressAction, saveBrandKitAction, signOutAction, updateDetailsAction } from '@/app/account/actions';
import type { BrandKit, Company, CompanyRole, DeliveryZone, SavedAddress } from '@/lib/api/order-types';
import { DELIVERY_ZONES } from '@/lib/pricing';
import { FilePicker } from '../order/controls';
import { ChoiceGroup, TextArea, TextField } from '../quote/fields';

/** The account page's forms. Each saves on its own and refreshes the page from the server. */

type Result = { ok: true } | { ok: false; message: string; errors?: Record<string, string> };

function useSave() {
  const router = useRouter();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const save = (fn: () => Promise<Result>, done = 'Saved.', onOk?: () => void) => {
    setMessage(null);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        setErrors({});
        setMessage({ ok: true, text: done });
        onOk?.();
        router.refresh();
      } else {
        setErrors(result.errors ?? {});
        setMessage({ ok: false, text: result.message });
      }
    });
  };
  return { message, errors, pending, save };
}

const saveButton =
  'inline-flex min-h-12 items-center justify-center border border-ink px-6 font-semibold text-ink transition-colors hover:bg-ink hover:text-bg disabled:opacity-60';

function Feedback({ message }: { message: { ok: boolean; text: string } | null }) {
  return (
    <p aria-live="polite" role={message && !message.ok ? 'alert' : undefined} className={`min-h-6 text-sm ${message?.ok ? 'text-heading' : 'text-accent-ink'}`}>
      {message?.text}
    </p>
  );
}

export function DetailsForm({ initial }: { initial: { name: string; phone: string; company: string } }) {
  const [d, setD] = useState(initial);
  const { message, pending, save } = useSave();
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        save(() => updateDetailsAction(d));
      }}
      className="flex flex-col gap-4"
    >
      <TextField name="acc-name" label="Your name" autoComplete="name" value={d.name} onChange={(v) => setD({ ...d, name: v })} />
      <TextField name="acc-company" label="Company" optional autoComplete="organization" value={d.company} onChange={(v) => setD({ ...d, company: v })} />
      <TextField name="acc-phone" type="tel" inputMode="tel" label="Phone" hint="For M-Pesa and deliveries." optional autoComplete="tel" value={d.phone} onChange={(v) => setD({ ...d, phone: v })} />
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={saveButton}>
          Save details
        </button>
        <Feedback message={message} />
      </div>
    </form>
  );
}

export function BrandKitForm({ initial }: { initial: BrandKit }) {
  const [colours, setColours] = useState(initial.colours.join(', '));
  const [typography, setTypography] = useState<BrandKit['typography']>(initial.typography);
  const [fonts, setFonts] = useState(initial.fonts);
  const [logos, setLogos] = useState(initial.logos);
  const [notes, setNotes] = useState(initial.notes);
  const { message, errors, pending, save } = useSave();
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        save(() =>
          saveBrandKitAction({
            colours: colours.split(',').map((c) => c.trim()).filter(Boolean),
            typography,
            fonts,
            logos,
            notes,
          }),
          'Brand kit saved. New orders start with it.',
        );
      }}
      className="flex flex-col gap-5"
    >
      <TextField name="kit-colours" label="Brand colours" hint="HEX or Pantone, separated by commas: #D7000F, 485 C" value={colours} onChange={setColours} error={errors.colours} />
      <ChoiceGroup
        name="kit-typography"
        legend="Fonts"
        value={typography}
        onChange={setTypography}
        options={[
          { value: 'from-logo', label: 'Match the logo' },
          { value: 'designer', label: 'Designer’s choice' },
          { value: 'named', label: 'These fonts' },
        ]}
        columns={3}
      />
      {typography === 'named' && <TextField name="kit-fonts" label="Font names" value={fonts} onChange={setFonts} error={errors.fonts} />}
      <FilePicker id="kit-logos" label="Logo files" hint="SVG, AI, EPS or PDF are best. Only the names are kept for now: send the files on WhatsApp once." files={logos} onChange={setLogos} />
      <TextArea name="kit-notes" label="Anything a designer should always know" value={notes} onChange={setNotes} maxLength={1000} />
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={saveButton}>
          Save brand kit
        </button>
        <Feedback message={message} />
      </div>
    </form>
  );
}

export function AddressBook({ addresses, max }: { addresses: SavedAddress[]; max: number }) {
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [zone, setZone] = useState<DeliveryZone>('inner');
  const { message, pending, save } = useSave();
  return (
    <div className="flex flex-col gap-5">
      {addresses.length > 0 && (
        <ul className="flex flex-col gap-2">
          {addresses.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-3 border border-border p-4">
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-heading">{a.label}</p>
                <p className="break-words text-body">{a.address}</p>
                <p className="text-muted">{DELIVERY_ZONES.find((z) => z.zone === a.zone)?.label}</p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => save(() => removeAddressAction(a.id), 'Address removed.')}
                aria-label={`Remove ${a.label}`}
                className="grid size-11 shrink-0 place-items-center text-muted transition-colors hover:text-heading"
              >
                <Trash2 aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {addresses.length < max && (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            save(() => saveAddressAction({ label, address, zone }), 'Address saved.', () => {
              setLabel('');
              setAddress('');
            });
          }}
          className="flex flex-col gap-4 bg-paper p-5"
        >
          <p className="font-semibold text-heading">Add a delivery address</p>
          <TextField name="addr-label" label="Name it" placeholder="Office, Warehouse…" value={label} onChange={setLabel} />
          <TextField name="addr-address" label="Address" hint="Building, street, area and town." autoComplete="street-address" value={address} onChange={setAddress} />
          <ChoiceGroup
            name="addr-zone"
            legend="Delivery zone"
            value={zone}
            onChange={setZone}
            options={DELIVERY_ZONES.map((z) => ({ value: z.zone, label: z.label, description: z.note }))}
          />
          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" disabled={pending} className={saveButton}>
              Save address
            </button>
            <Feedback message={message} />
          </div>
        </form>
      )}
    </div>
  );
}

export function CreateCompanyForm({ defaultName }: { defaultName: string }) {
  const [name, setName] = useState(defaultName);
  const [kraPin, setKraPin] = useState('');
  const { message, pending, save } = useSave();
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        save(() => createCompanyAction({ name, kraPin }), 'Company set up.');
      }}
      className="flex flex-col gap-4 bg-paper p-5"
    >
      <TextField name="co-name" label="Company name" autoComplete="organization" value={name} onChange={setName} />
      <TextField name="co-pin" label="KRA PIN" optional hint="For your invoices, like P051234567X." value={kraPin} onChange={setKraPin} />
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={saveButton}>
          Set up the company
        </button>
        <Feedback message={message} />
      </div>
    </form>
  );
}

const ROLE_LABEL: Record<CompanyRole, string> = { owner: 'Owner', approver: 'Approves proofs', member: 'Orders' };

/** The company's people. The owner adds and removes them; everyone else sees who approves. */
export function CompanyMembers({ company, isOwner, myEmail }: { company: Company; isOwner: boolean; myEmail: string }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'member' | 'approver'>('member');
  const { message, pending, save } = useSave();
  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col border-t border-border">
        {company.members.map((m) => (
          <li key={m.email} className="flex items-center justify-between gap-3 border-b border-border py-2 text-sm">
            <span className="min-w-0">
              <span className="block font-semibold text-heading">
                {m.name}
                {m.email === myEmail && ' (you)'}
              </span>
              <span className="block break-all text-muted">
                {m.email} · {ROLE_LABEL[m.role]}
              </span>
            </span>
            {isOwner && m.role !== 'owner' && (
              <button
                type="button"
                disabled={pending}
                onClick={() => save(() => removeMemberAction(m.email), `${m.name} removed.`)}
                aria-label={`Remove ${m.name}`}
                className="grid size-11 shrink-0 place-items-center text-muted transition-colors hover:text-heading"
              >
                <Trash2 aria-hidden className="size-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {isOwner ? (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            save(() => addMemberAction({ email, name, role }), 'Added. They sign in with their own email.', () => {
              setEmail('');
              setName('');
            });
          }}
          className="flex flex-col gap-4 bg-paper p-5"
        >
          <p className="font-semibold text-heading">Add someone</p>
          <TextField name="member-name" label="Name" value={name} onChange={setName} />
          <TextField name="member-email" type="email" inputMode="email" label="Email" value={email} onChange={setEmail} />
          <ChoiceGroup
            name="member-role"
            legend="They can"
            value={role}
            onChange={setRole}
            options={[
              { value: 'member', label: 'Order', description: 'Their proofs wait for an approver' },
              { value: 'approver', label: 'Order and approve proofs', description: 'For anyone in the company' },
            ]}
          />
          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" disabled={pending} className={saveButton}>
              Add to the company
            </button>
            <Feedback message={message} />
          </div>
        </form>
      ) : (
        <Feedback message={message} />
      )}
    </div>
  );
}

export function SignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await signOutAction();
          router.refresh();
        })
      }
      className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-link underline underline-offset-4"
    >
      <LogOut aria-hidden className="size-4" /> Sign out
    </button>
  );
}
