// @ts-check
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * WhatsApp (Meta Cloud API, approved templates; docs/BACKEND_RUNBOOK.md, section 2.3). The fake
 * writes each message as JSON into `WHATSAPP_OUTBOX_DIR`. The live client comes once Meta approves
 * the templates; config.js refuses WHATSAPP_MODE=live until then. `off` (no WhatsApp Business account
 * yet) sends nothing: the notifications service marks those messages skipped and the email still goes.
 *
 * @typedef {{ to: string; template: string; text: string }} WhatsAppMessage
 * @typedef {{ mode: 'fake' | 'live' | 'off'; send: (m: WhatsAppMessage) => Promise<void> }} WhatsAppClient
 */

/**
 * @param {{ mode?: 'fake' | 'live' | 'off'; outboxDir: string }} o
 * @returns {WhatsAppClient}
 */
export function createWhatsApp({ mode = 'fake', outboxDir }) {
  if (mode === 'off') return { mode, send: async () => {} };
  return {
    mode: 'fake',
    async send(m) {
      await mkdir(outboxDir, { recursive: true });
      const name = `${new Date().toISOString().replace(/[:.]/g, '-')}-${m.template}-${m.to.replace(/\D/g, '')}.json`;
      await writeFile(join(outboxDir, name), JSON.stringify({ ...m, at: new Date().toISOString() }, null, 2));
    },
  };
}
