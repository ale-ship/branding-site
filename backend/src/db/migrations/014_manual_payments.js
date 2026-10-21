// @ts-check

/**
 * Migration 014: payments recorded by hand (owner, 21 Oct 2026). Until the M-Pesa prompt is
 * connected, customers pay to the Paybill on their invoice and a designer records the payment in the
 * back office: method `manual`, with how it was paid (`channel`) and who recorded it. The customer
 * can say they've paid, with their M-Pesa code, before staff record it: `orders.payment_report`.
 * With WHATSAPP_MODE=off (no WhatsApp Business account yet), WhatsApp messages are `skipped`: the
 * customer still gets the email.
 */

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.raw(`
    ALTER TABLE payments DROP CONSTRAINT payments_method_check;
    ALTER TABLE payments ADD CONSTRAINT payments_method_check CHECK (method IN ('stk', 'paybill', 'manual'));
    ALTER TABLE payments ADD COLUMN channel text CHECK (channel IN ('mpesa', 'bank', 'cash'));
    ALTER TABLE payments ADD COLUMN recorded_by integer REFERENCES staff_users (id);
    ALTER TABLE payments ADD CONSTRAINT payments_manual_check
      CHECK ((method = 'manual') = (channel IS NOT NULL AND recorded_by IS NOT NULL));
    ALTER TABLE orders ADD COLUMN payment_report jsonb;
    ALTER TABLE notifications DROP CONSTRAINT notifications_status_check;
    ALTER TABLE notifications ADD CONSTRAINT notifications_status_check CHECK (status IN ('pending', 'sent', 'failed', 'skipped'));
  `);
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.raw(`
    UPDATE notifications SET status = 'failed' WHERE status = 'skipped';
    ALTER TABLE notifications DROP CONSTRAINT notifications_status_check;
    ALTER TABLE notifications ADD CONSTRAINT notifications_status_check CHECK (status IN ('pending', 'sent', 'failed'));
    ALTER TABLE orders DROP COLUMN payment_report;
    DELETE FROM payments WHERE method = 'manual';
    ALTER TABLE payments DROP CONSTRAINT payments_manual_check;
    ALTER TABLE payments DROP COLUMN recorded_by;
    ALTER TABLE payments DROP COLUMN channel;
    ALTER TABLE payments DROP CONSTRAINT payments_method_check;
    ALTER TABLE payments ADD CONSTRAINT payments_method_check CHECK (method IN ('stk', 'paybill'));
  `);
}
