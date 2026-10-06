import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { Eyebrow } from '../ui/PrintMarks';
import { Reveal } from '../ui/Reveal';

type Props = {
  id: string;
  eyebrow: string;
  title: string;
  intro?: string;
  link?: { href: string; label: string };
  tone?: 'ink' | 'on-dark';
};

export function SectionHeading({ id, eyebrow, title, intro, link, tone = 'ink' }: Props) {
  const onDark = tone === 'on-dark';
  return (
    <Reveal className="mb-10 grid grid-cols-1 gap-6 sm:mb-14 lg:grid-cols-[1fr_auto] lg:items-end">
      <div className="max-w-3xl">
        <Eyebrow className={onDark ? 'text-on-dark-muted' : 'text-muted'}>{eyebrow}</Eyebrow>
        <h2
          id={id}
          className={`mt-4 text-[clamp(2.1rem,4.6vw,4rem)] leading-[1] font-bold ${onDark ? 'text-on-dark' : ''}`}
        >
          {title}
        </h2>
        {intro && <p className={`mt-5 max-w-xl text-lg ${onDark ? 'text-on-dark-muted' : 'text-body'}`}>{intro}</p>}
      </div>
      {link && (
        <Link
          href={link.href}
          className={`group inline-flex min-h-11 items-center gap-2 self-start font-semibold underline decoration-2 underline-offset-8 lg:self-end ${
            onDark ? 'text-on-dark decoration-accent' : 'text-heading decoration-accent'
          }`}
        >
          {link.label}
          <ArrowUpRight
            aria-hidden
            className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </Link>
      )}
    </Reveal>
  );
}
