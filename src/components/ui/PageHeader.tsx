import type { ReactNode } from 'react';
import { Container } from './Container';
import { Eyebrow } from './PrintMarks';
import { Reveal } from './Reveal';

type Props = {
  eyebrow: string;
  title: string;
  intro?: string;
  /** Anything under the intro: filters, buttons, metadata. */
  children?: ReactNode;
};

/** The opening of an inner page: eyebrow, a big h1 and a short intro. */
export function PageHeader({ eyebrow, title, intro, children }: Props) {
  return (
    <Container className="pt-12 pb-10 sm:pt-20 sm:pb-14">
      <Reveal>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-5 max-w-5xl text-[clamp(2.75rem,7vw,6.5rem)] leading-[0.95] font-extrabold tracking-[-0.035em]">
          {title}
        </h1>
        {intro && <p className="mt-6 max-w-2xl text-lg text-body sm:text-xl">{intro}</p>}
      </Reveal>
      {children}
    </Container>
  );
}
