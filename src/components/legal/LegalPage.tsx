import { Container } from '../ui/Container';
import { PageHeader } from '../ui/PageHeader';

export type LegalSection = { title: string; paragraphs: string[]; list?: string[] };

type Props = { eyebrow: string; title: string; intro: string; updated: string; sections: LegalSection[] };

/** Privacy and Terms: numbered sections, a contents list, and a visible "draft" notice. */
export function LegalPage({ eyebrow, title, intro, updated, sections }: Props) {
  const id = (i: number) => `section-${i + 1}`;
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} intro={intro}>
        {/* TODO(business): have a lawyer review this page, then remove the draft notice. */}
        <p role="note" className="mt-8 max-w-2xl border-l-4 border-accent bg-paper px-4 py-3 text-heading">
          <strong>Draft for legal review.</strong> This page is a working draft and will be checked before the site launches.
          Last updated {updated}.
        </p>
      </PageHeader>
      <Container className="grid grid-cols-1 gap-12 pb-20 sm:pb-28 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-20">
        <nav aria-label="On this page" className="lg:sticky lg:top-28 lg:self-start">
          <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">On this page</p>
          <ol className="mt-3 border-t border-border">
            {sections.map((s, i) => (
              <li key={s.title} className="border-b border-border">
                <a href={`#${id(i)}`} className="flex min-h-11 items-center gap-3 py-2 text-sm text-body hover:text-heading">
                  <span className="text-muted tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="max-w-3xl">
          {sections.map((s, i) => (
            <section key={s.title} id={id(i)} aria-labelledby={`${id(i)}-title`} className="scroll-mt-28 border-t border-border py-8 first:border-t-0 first:pt-0">
              <h2 id={`${id(i)}-title`} className="text-2xl font-bold sm:text-3xl">
                {i + 1}. {s.title}
              </h2>
              {s.paragraphs.map((p) => (
                <p key={p} className="mt-4 text-body">
                  {p}
                </p>
              ))}
              {s.list && (
                <ul className="mt-4 list-disc space-y-2 pl-5 text-body marker:text-muted">
                  {s.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </Container>
    </>
  );
}
