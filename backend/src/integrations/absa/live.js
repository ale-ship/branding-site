// @ts-check

/**
 * The real Absa client: OAuth token, STK Push, STK status query, C2B URL registration. Written once
 * Absa sends its API documentation and sandbox credentials (docs/BACKEND_RUNBOOK.md, section 14);
 * config.js refuses ABSA_MODE=live until then.
 * @returns {import('./index.js').AbsaClient}
 */
export function createLiveAbsa() {
  throw new Error('ABSA_MODE=live is not built yet: it needs Absa’s API documentation (docs/BACKEND_RUNBOOK.md, section 14).');
}
