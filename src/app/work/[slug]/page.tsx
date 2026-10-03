import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { QuoteCta } from '@/components/home/QuoteCta';
import { CaseStudy } from '@/components/work/CaseStudy';
import { api } from '@/lib/api';
import { site } from '@/lib/site';
import { nextProject, projectHref } from '@/lib/work';

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await api.listProjects()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const project = await api.getProject((await params).slug);
  if (!project) return {};
  return {
    title: project.title,
    description: project.summary,
    alternates: { canonical: projectHref(project.slug) },
    openGraph: { title: project.title, description: project.summary, images: [{ url: project.cover.src, alt: project.cover.alt }] },
    // Sample projects are placeholders and must never be indexed.
    robots: project.sample ? { index: false, follow: true } : undefined,
  };
}

export default async function CaseStudyPage({ params }: Props) {
  const { slug } = await params;
  const [project, projects, services] = await Promise.all([api.getProject(slug), api.listProjects(), api.listServices()]);
  if (!project) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: project.title,
    description: project.summary,
    image: new URL(project.cover.src, site.url).toString(),
    dateCreated: String(project.year),
    creator: { '@type': 'Organization', name: site.name, url: site.url },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <CaseStudy project={project} services={services} next={nextProject(projects, slug)} />
      <QuoteCta />
    </>
  );
}
