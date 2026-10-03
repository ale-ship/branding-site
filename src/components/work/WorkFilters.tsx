import Link from 'next/link';
import { hasFilters, workHref, type Facet, type WorkFacets, type WorkFilters } from '@/lib/work';

const chip =
  'inline-flex min-h-11 shrink-0 items-center gap-2 border px-4 text-sm font-medium whitespace-nowrap transition-colors';
const idle = 'border-border-strong text-heading hover:border-ink';
const active = 'border-ink bg-ink text-bg';
const empty = 'border-border text-muted';

type Key = keyof WorkFilters;

/**
 * Filter rows (Branding Style Guides). Plain links, so they work without JavaScript. Each row
 * scrolls sideways on phones and wraps from 640 px. Counts say how many results a click gives;
 * an option that would give none is shown but not linked.
 */
export function WorkFiltersBar({ facets, filters }: { facets: WorkFacets; filters: WorkFilters }) {
  return (
    <nav aria-label="Filter work" className="mt-10 flex flex-col gap-5 border-t border-border pt-6 sm:mt-12">
      <Row label="Service" name="service" options={facets.services} filters={filters} />
      <Row label="Industry" name="industry" options={facets.industries} filters={filters} />
      <Row label="Year" name="year" options={facets.years} filters={filters} />
      {hasFilters(filters) && (
        <Link href="/work" className="self-start text-sm font-semibold text-heading underline decoration-accent decoration-2 underline-offset-4">
          Clear all filters
        </Link>
      )}
    </nav>
  );
}

function Row<T extends string | number>({
  label,
  name,
  options,
  filters,
}: {
  label: string;
  name: Key;
  options: Facet<T>[];
  filters: WorkFilters;
}) {
  const current = filters[name];
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[7rem_1fr] sm:items-start">
      <p className="pt-3 text-xs font-semibold tracking-[0.18em] text-muted uppercase">{label}</p>
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        <li>
          <Link
            href={workHref({ ...filters, [name]: undefined })}
            aria-current={current === undefined ? 'true' : undefined}
            className={`${chip} ${current === undefined ? active : idle}`}
          >
            All
          </Link>
        </li>
        {options.map((option) => {
          const selected = current === option.value;
          const content = (
            <>
              {option.label}
              <span className={selected ? 'text-bg/70' : 'text-muted'}>{option.count}</span>
            </>
          );
          return (
            <li key={String(option.value)}>
              {option.count === 0 && !selected ? (
                <span aria-disabled="true" className={`${chip} ${empty}`}>
                  {content}
                </span>
              ) : (
                <Link
                  // A second click on the selected option clears it.
                  href={workHref({ ...filters, [name]: selected ? undefined : option.value })}
                  aria-current={selected ? 'true' : undefined}
                  className={`${chip} ${selected ? active : idle}`}
                >
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
