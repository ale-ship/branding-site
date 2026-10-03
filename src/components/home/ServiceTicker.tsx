import type { Service } from '@/lib/api';
import { Marquee } from '../ui/Marquee';
import { RegMark } from '../ui/PrintMarks';

/** A big, slow ticker of service names between registration marks. */
export function ServiceTicker({ services }: { services: Service[] }) {
  return (
    <section aria-label="What we make" className="border-b border-border py-8 sm:py-12">
      <Marquee
        items={services.map((service) => (
          <span
            key={service.slug}
            className="flex items-center gap-8 pr-8 font-display text-[clamp(2.25rem,6vw,5rem)] leading-none font-bold tracking-[-0.03em] text-heading"
          >
            {service.name}
            <RegMark className="size-8 text-accent sm:size-10" />
          </span>
        ))}
      />
    </section>
  );
}
