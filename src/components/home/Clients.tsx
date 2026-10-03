import Image from 'next/image';
import type { Client } from '@/lib/api';
import { Container } from '../ui/Container';
import { Eyebrow } from '../ui/PrintMarks';
import { Marquee } from '../ui/Marquee';

/** Client logos on a slow ticker. TODO(business): placeholders until real logos arrive. */
export function Clients({ clients }: { clients: Client[] }) {
  if (!clients.length) return null;
  return (
    <section aria-labelledby="clients-title" className="border-y border-border py-14 sm:py-20">
      <Container className="mb-8">
        <Eyebrow>
          <span id="clients-title">Trusted by teams across Kenya</span>
        </Eyebrow>
      </Container>
      <Marquee
        items={clients.map((client) => (
          <span key={client.name} className="mr-4 grid h-24 w-48 place-items-center border border-border sm:w-56">
            {client.logo ? (
              <Image src={client.logo.src} alt={client.name} width={160} height={64} className="object-contain" />
            ) : (
              <span className="font-display text-lg font-semibold text-muted">{client.name}</span>
            )}
          </span>
        ))}
      />
    </section>
  );
}
