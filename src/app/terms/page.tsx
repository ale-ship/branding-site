import type { Metadata } from 'next';
import { LegalPage, type LegalSection } from '@/components/legal/LegalPage';
import { site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Terms',
  description: `The terms for quotes and orders with ${site.name}.`,
  alternates: { canonical: '/terms' },
};

/** TODO(business): draft wording. Noorcom to confirm every number here; a lawyer to review. */
const sections: LegalSection[] = [
  {
    title: 'Quotes and prices',
    paragraphs: [
      'Prices on this website are per piece, in Kenya shillings, before design, delivery and installation. They are a guide: your written quote is the price we hold you to.',
      'A quote is valid for 14 days. Prices for large runs may be lower than the prices shown.',
    ],
  },
  {
    title: 'Minimum quantities',
    paragraphs: ['Each item has a minimum order, shown on its page. Smaller runs can sometimes be done at a different price; ask us.'],
  },
  {
    title: 'Artwork and proofs',
    paragraphs: [
      'You confirm that you own, or have permission to use, the logos, images and text you send us.',
      'We send a proof before printing. Please check it carefully: spelling, phone numbers, colours and sizes. Once you approve a proof, we print exactly what it shows, and reprints caused by errors in an approved proof are charged.',
      'Colours on screen look different from colours in print. If an exact colour matters, ask for a printed sample.',
    ],
  },
  {
    title: 'Payment',
    paragraphs: [
      'Work starts when the proof is approved and the deposit stated in your quote is paid. The balance is due on collection, delivery or installation, unless your quote says otherwise.',
    ],
  },
  {
    title: 'Turnaround',
    paragraphs: [
      'Turnaround times run from the day the proof is approved and the deposit is paid. They are our honest estimate; we’ll tell you straight away if anything changes.',
    ],
  },
  {
    title: 'Delivery and installation',
    paragraphs: [
      'For installation, you arrange access to the site and any landlord or county permission needed. Our quote assumes a normal working height and surface; we’ll tell you before we start if the site needs more.',
    ],
  },
  {
    title: 'Changes and cancellations',
    paragraphs: [
      'You can change or cancel an order free of charge before you approve the proof. After that, work already done and materials already bought are charged.',
    ],
  },
  {
    title: 'If something is wrong',
    paragraphs: [
      'Check your order when you receive it and tell us within 7 days if anything is wrong. If it’s our mistake, we’ll reprint or fix it at our cost.',
    ],
  },
  {
    title: 'Contact',
    paragraphs: [`${site.name}, ${site.address}. ${site.phone} · ${site.email}.`],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms"
      title="Terms for quotes and orders"
      intro="The plain rules for working with us: prices, proofs, payment and what happens if something goes wrong."
      updated="3 October 2026"
      sections={sections}
    />
  );
}
