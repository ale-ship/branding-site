import { api } from '@/lib/api';
import { pad2 } from '@/lib/format';
import { Container } from '../ui/Container';
import { Contours } from '../ui/PrintMarks';
import { Reveal } from '../ui/Reveal';
import { SectionHeading } from './SectionHeading';

/** Columns on a wide screen for 3 to 6 steps (full class names, so Tailwind finds them). */
const WIDE = { 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5', 6: 'lg:grid-cols-6' } as Record<number, string>;

/** The page's one dark section. Steps from Website → Pages in the back office. */
export async function Process() {
  const { eyebrow, title, steps } = (await api.getPageContent()).home.process;
  // Two columns on tablets: an odd last step spans both.
  const odd = steps.length % 2 === 1;
  return (
    <section aria-labelledby="process-title" className="relative isolate bg-dark py-20 text-on-dark sm:py-32">
      <Contours field="text-on-dark/[0.07]" hill="text-brand-red/80" />
      <Container>
        <SectionHeading id="process-title" tone="on-dark" eyebrow={eyebrow} title={title} link={{ href: '/quote', label: 'Start with a brief' }} />
        <ol className={`grid grid-cols-1 gap-px bg-on-dark/15 sm:grid-cols-2 ${WIDE[steps.length] ?? 'lg:grid-cols-5'}`}>
          {steps.map((step, i) => (
            <Reveal
              as="li"
              key={i}
              delay={i * 90}
              className={`flex flex-col gap-10 bg-dark p-6 sm:p-8 ${odd ? 'last:sm:col-span-2 lg:last:col-span-1' : ''}`}
            >
              <span className="text-sm font-semibold text-on-dark-muted tabular-nums">{pad2(i + 1)}</span>
              <span>
                <span className="block font-display text-3xl font-bold text-on-dark">{step.name}</span>
                <span className="mt-3 block text-on-dark-muted">{step.text}</span>
              </span>
            </Reveal>
          ))}
        </ol>
      </Container>
    </section>
  );
}
