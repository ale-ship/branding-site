import type { Metadata } from 'next';
import { LegalPage, type LegalSection } from '@/components/legal/LegalPage';
import { site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Privacy notice',
  description: `How ${site.name} collects, uses and protects your personal data.`,
  alternates: { canonical: '/privacy' },
};

/** TODO(business): draft wording; a lawyer must review it before launch (Data Protection Act, 2019). */
const sections: LegalSection[] = [
  {
    title: 'Who we are',
    paragraphs: [
      `${site.name} (“we”, “us”) designs, prints and installs branding from ${site.address}. We decide how your personal data is used, so under Kenya’s Data Protection Act, 2019 we are its data controller.`,
      `Questions about this notice or your data: ${site.email} or ${site.phone}.`,
    ],
  },
  {
    title: 'What we collect',
    paragraphs: ['Only what you give us through this website, WhatsApp, phone or email:'],
    list: [
      'Quote requests: your name, company, phone, email, what you need, quantities, deadline, delivery or installation location, and the names of artwork files you attach.',
      'Contact messages: your name, phone, email and message.',
      'Your quote list: the shop items you add are kept in your own browser (local storage) until you send them or clear them. We don’t receive them until you send a request.',
      'Basic technical data our servers record for every website visit (such as IP address and browser type), kept for security.',
    ],
  },
  {
    title: 'Why we use it',
    paragraphs: ['We use your data to:'],
    list: [
      'reply to your request, prepare your quote and send proofs;',
      'make, deliver and install what you order, and invoice you for it;',
      'keep our records as the law requires;',
      'keep this website secure.',
    ],
  },
  {
    title: 'Our lawful basis',
    paragraphs: [
      'We use your data because you asked us to (to take steps towards a contract with you), to perform that contract, to meet legal obligations such as tax records, and in our legitimate interest in running a secure website. We don’t use it for marketing unless you agree.',
    ],
  },
  {
    title: 'Who we share it with',
    paragraphs: [
      'We don’t sell your data. We share it only with people who help us do the job: couriers and installers who need your delivery details, and the companies that host this website and our email. Each of them may only use it for that purpose.',
    ],
  },
  {
    title: 'How long we keep it',
    paragraphs: [
      'Quote requests that don’t become orders: up to 12 months, so we can pick up where we left off. Orders and invoices: as long as Kenyan tax law requires. Then we delete it or make it anonymous.',
    ],
  },
  {
    title: 'Your rights',
    paragraphs: ['You have the right to:'],
    list: [
      'be told how your data is used (this notice);',
      'see the data we hold about you;',
      'have wrong data corrected, and data we no longer need deleted;',
      'object to how we use your data.',
    ],
  },
  {
    title: 'Complaints',
    paragraphs: [
      `Tell us first at ${site.email} and we’ll try to put it right. You can also complain to the Office of the Data Protection Commissioner (ODPC), Kenya.`,
    ],
  },
  {
    title: 'Changes to this notice',
    paragraphs: ['We’ll update this page if anything changes, and show the date at the top.'],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy"
      title="Privacy notice"
      intro="What we collect when you ask us for a quote or a message, why, and what you can ask us to do with it."
      updated="3 October 2026"
      sections={sections}
    />
  );
}
