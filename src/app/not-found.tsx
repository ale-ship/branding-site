import type { Metadata } from 'next';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { Container } from '@/components/ui/Container';
import { CropMarks, Eyebrow } from '@/components/ui/PrintMarks';
import { quoteHref } from '@/lib/site';

export const metadata: Metadata = { title: 'Page not found', robots: { index: false } };

export default function NotFound() {
  return (
    <Container className="py-24 sm:py-36">
      <div className="relative max-w-3xl">
        <CropMarks />
        <div className="bg-paper p-8 sm:p-14">
          <Eyebrow>Error 404</Eyebrow>
          <h1 className="mt-5 text-[clamp(2.5rem,7vw,5.5rem)] leading-[0.95] font-extrabold">
            This page didn’t make it to print.
          </h1>
          <p className="mt-6 max-w-lg text-lg text-body">
            The page you’re looking for has moved or doesn’t exist yet. Try the home page, or tell us what
            you need.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <ButtonLink href="/">Back to home</ButtonLink>
            <ButtonLink href={quoteHref} variant="outline">
              Get a quote
            </ButtonLink>
          </div>
        </div>
      </div>
    </Container>
  );
}
