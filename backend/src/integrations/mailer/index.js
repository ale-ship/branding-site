// @ts-check
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import nodemailer from 'nodemailer';

/**
 * Email from info@noorcombranding.co.ke (docs/BACKEND_RUNBOOK.md, section 2.3). With `SMTP_HOST` set
 * it sends through that server; without, each message is written as an .eml file into the outbox
 * folder (open it in any mail program), built by the same nodemailer code.
 *
 * @typedef {{ to: string; subject: string; text: string }} Mail
 * @typedef {{ mode: 'fake' | 'live'; send: (m: Mail) => Promise<void> }} Mailer
 */

/**
 * @param {{ from: string; outboxDir: string; smtp: { host: string; port: number; user: string; pass: string } | null }} o
 * @returns {Mailer}
 */
export function createMailer({ from, outboxDir, smtp }) {
  if (smtp) {
    const transport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      ...(smtp.user ? { auth: { user: smtp.user, pass: smtp.pass } } : {}),
    });
    return {
      mode: 'live',
      async send(m) {
        await transport.sendMail({ from, ...m });
      },
    };
  }
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'windows' });
  return {
    mode: 'fake',
    async send(m) {
      const info = await transport.sendMail({ from, ...m });
      await mkdir(outboxDir, { recursive: true });
      const name = `${new Date().toISOString().replace(/[:.]/g, '-')}-${m.to.replace(/[^a-z0-9]/gi, '_')}.eml`;
      await writeFile(join(outboxDir, name), /** @type {Buffer} */ (info.message));
    },
  };
}
