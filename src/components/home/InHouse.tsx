import Image from 'next/image';
import { ButtonLink } from '../ui/ButtonLink';
import { Container } from '../ui/Container';
import { CropMarks, Eyebrow } from '../ui/PrintMarks';
import { Reveal } from '../ui/Reveal';

/** "Behind the scenes" (Mindsparkle): the workshop as proof. Photos are placeholders. */
export function InHouse() {
  return (
    <section aria-labelledby="inhouse-title" className="py-20 sm:py-32">
      <Container className="grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-10">
        <div className="flex flex-col justify-between gap-10 lg:col-span-5">
          <Reveal>
            <Eyebrow>Behind the scenes</Eyebrow>
            <h2 id="inhouse-title" className="mt-4 text-[clamp(2.1rem,4.6vw,4rem)] leading-[1] font-bold">
              Made in our own workshop, not sent out.
            </h2>
            <p className="mt-6 max-w-md text-lg text-body">
              Our designers sit next to our printers. You see a proof before anything is printed, and the
              people who print it are the ones who install it.
            </p>
            <ButtonLink href="/about" variant="outline" className="mt-8">
              About the studio
            </ButtonLink>
          </Reveal>
          <Reveal delay={120} className="relative hidden aspect-[4/3] lg:block">
            <Image
              src="/images/placeholder/screen-inks.jpg"
              alt="Tubs of screen-printing ink on the workbench"
              fill
              sizes="35vw"
              className="object-cover"
            />
          </Reveal>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:col-span-7">
          <Reveal className="relative col-span-2 aspect-[16/10]">
            <div className="relative size-full overflow-hidden bg-panel">
              <Image
                src="/images/placeholder/heat-press.jpg"
                alt="A printer preparing a black t-shirt on the heat press"
                fill
                sizes="(min-width: 1024px) 55vw, 100vw"
                className="object-cover"
              />
            </div>
            <CropMarks />
          </Reveal>
          <Reveal delay={100} className="relative aspect-[4/5] overflow-hidden bg-panel">
            <Image
              src="/images/placeholder/team-review.jpg"
              alt="Three designers reviewing a proof together on a laptop"
              fill
              sizes="(min-width: 1024px) 28vw, 50vw"
              className="object-cover"
            />
          </Reveal>
          <Reveal delay={200} className="relative aspect-[4/5] overflow-hidden bg-panel">
            <Image
              src="/images/placeholder/press-offset.jpg"
              alt="An offset press with its ink rollers"
              fill
              sizes="(min-width: 1024px) 28vw, 50vw"
              className="object-cover"
            />
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
