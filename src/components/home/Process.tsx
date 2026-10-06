import { pad2 } from '@/lib/format';
import { Container } from '../ui/Container';
import { Reveal } from '../ui/Reveal';
import { SectionHeading } from './SectionHeading';

/** TODO(business): confirm the steps and typical turnaround with Noorcom. */
const steps = [
  { name: 'Brief', text: 'Tell us what you need, how many and by when. We reply the same working day.' },
  { name: 'Design', text: 'Our studio designs it, or prepares your artwork so it prints perfectly.' },
  { name: 'Proof', text: 'You approve a digital proof, or a physical sample for bigger runs.' },
  { name: 'Print', text: 'Made in our workshop on our own machines, checked piece by piece.' },
  { name: 'Install', text: 'Delivered or installed by the same team, anywhere in Kenya.' },
];

/** The page's one dark section. */
export function Process() {
  return (
    <section aria-labelledby="process-title" className="bg-dark py-20 text-on-dark sm:py-32">
      <Container>
        <SectionHeading
          id="process-title"
          tone="on-dark"
          eyebrow="How a job runs"
          title="From brief to installed, in five steps"
          link={{ href: '/quote', label: 'Start with a brief' }}
        />
        <ol className="grid grid-cols-1 gap-px bg-on-dark/15 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map((step, i) => (
            <Reveal as="li" key={step.name} delay={i * 90} className="flex flex-col gap-10 bg-dark p-6 last:sm:col-span-2 sm:p-8 lg:last:col-span-1">
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
