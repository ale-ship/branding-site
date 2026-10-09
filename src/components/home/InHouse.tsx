import Image from 'next/image';
import { api } from '@/lib/api';
import { ButtonLink } from '../ui/ButtonLink';
import { Container } from '../ui/Container';
import { CropMarks, Eyebrow } from '../ui/PrintMarks';
import { Reveal } from '../ui/Reveal';

/** "Behind the scenes" (Mindsparkle): the workshop as proof. Words and photos from Website → Pages. */
export async function InHouse() {
  const { eyebrow, title, text, buttonLabel, images } = (await api.getPageContent()).home.inHouse;
  const [main, left, right, side] = images;
  return (
    <section aria-labelledby="inhouse-title" className="py-20 sm:py-32">
      <Container className="grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-10">
        <div className="flex flex-col justify-between gap-10 lg:col-span-5">
          <Reveal>
            <Eyebrow>{eyebrow}</Eyebrow>
            <h2 id="inhouse-title" className="mt-4 text-[clamp(2.1rem,4.6vw,4rem)] leading-[1] font-bold">
              {title}
            </h2>
            <p className="mt-6 max-w-md text-lg text-body">{text}</p>
            <ButtonLink href="/about" variant="outline" className="mt-8">
              {buttonLabel}
            </ButtonLink>
          </Reveal>
          {side && (
            <Reveal delay={120} className="relative hidden aspect-[4/3] lg:block">
              <Image src={side.src} alt={side.alt} fill sizes="35vw" className="object-cover" />
            </Reveal>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:col-span-7">
          {main && (
            <Reveal className="relative col-span-2 aspect-[16/10]">
              <div className="relative size-full overflow-hidden bg-panel">
                <Image src={main.src} alt={main.alt} fill sizes="(min-width: 1024px) 55vw, 100vw" className="object-cover" />
              </div>
              <CropMarks />
            </Reveal>
          )}
          {left && (
            <Reveal delay={100} className="relative aspect-[4/5] overflow-hidden bg-panel">
              <Image src={left.src} alt={left.alt} fill sizes="(min-width: 1024px) 28vw, 50vw" className="object-cover" />
            </Reveal>
          )}
          {right && (
            <Reveal delay={200} className="relative aspect-[4/5] overflow-hidden bg-panel">
              <Image src={right.src} alt={right.alt} fill sizes="(min-width: 1024px) 28vw, 50vw" className="object-cover" />
            </Reveal>
          )}
        </div>
      </Container>
    </section>
  );
}
