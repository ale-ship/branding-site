import Image from 'next/image';
import Link from 'next/link';
import type { Project } from '@/lib/api';
import { projectHref } from '@/lib/work';

type Size = 'large' | 'small' | 'grid';

const titleSize: Record<Size, string> = {
  large: 'text-[clamp(1.6rem,2.6vw,2.25rem)]',
  small: 'text-xl sm:text-2xl lg:text-lg xl:text-2xl',
  grid: 'text-xl sm:text-2xl',
};

const imageSizes: Record<Size, string> = {
  large: '(min-width: 1024px) 50vw, 100vw',
  small: '(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw',
  grid: '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw',
};

type Props = {
  project: Project;
  size: Size;
  /** The page's main image: preloaded and fetched first. Only for the first card(s) on screen. */
  priority?: boolean;
  /** Heading level for the title, so each page keeps a correct outline. */
  as?: 'h2' | 'h3';
};

/** A project as a big image, its title and one line of metadata (BP&O). */
export function ProjectCard({ project, size, priority, as: Heading = 'h3' }: Props) {
  return (
    <Link href={projectHref(project.slug)} className="group block">
      {/* The large card is taller on desktop so it lines up with the 2×2 grid beside it. */}
      <div
        className={`relative aspect-[3/2] overflow-hidden bg-panel ${size === 'large' ? 'lg:aspect-square xl:aspect-[6/5]' : ''}`}
      >
        <Image
          src={project.cover.src}
          alt={project.cover.alt}
          fill
          preload={priority}
          fetchPriority={priority ? 'high' : undefined}
          sizes={imageSizes[size]}
          className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.04]"
        />
        {project.sample && (
          <span className="absolute top-3 left-3 bg-bg px-2.5 py-1 text-[0.7rem] font-semibold tracking-[0.14em] text-heading uppercase">
            Sample
          </span>
        )}
      </div>
      <Heading
        className={`mt-4 leading-tight font-bold tracking-[-0.02em] transition-colors group-hover:text-accent-ink ${titleSize[size]}`}
      >
        {project.title}
      </Heading>
      <p className="mt-1.5 text-sm text-muted">
        {project.client} · {project.industry} · {project.year}
      </p>
    </Link>
  );
}
