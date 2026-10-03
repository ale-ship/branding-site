import { MessageCircle } from 'lucide-react';
import { site } from '@/lib/site';

/** Floating WhatsApp button, bottom right on every page. */
export function WhatsAppButton() {
  return (
    <a
      href={site.whatsappHref}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fixed right-4 bottom-4 z-30 grid size-14 place-items-center rounded-pill bg-whatsapp text-bg shadow-[0_10px_30px_-8px_rgba(15,26,46,0.5)] transition-[background-color,transform] duration-300 hover:-translate-y-0.5 hover:bg-whatsapp-hover sm:right-6 sm:bottom-6"
    >
      <MessageCircle aria-hidden className="size-6" />
    </a>
  );
}
