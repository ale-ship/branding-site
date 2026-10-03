import { products } from './data/products';
import { clients, projects } from './data/projects';
import { services } from './data/services';
import type { ContactMessage, ListOptions, QuoteRequest, SiteApi } from './types';

function pick<T extends { featured: boolean }>(items: T[], { featured, limit }: ListOptions = {}): T[] {
  const filtered = featured === undefined ? items : items.filter((item) => item.featured === featured);
  return limit === undefined ? filtered : filtered.slice(0, limit);
}

/**
 * Quote requests received by the mock, newest last. Lives only as long as the server process;
 * our own backend will store and email them (RUNBOOK.md, Phase 3).
 */
export const receivedQuotes: (QuoteRequest & { reference: string; receivedAt: string })[] = [];

/** Contact-form messages received by the mock, newest last. */
export const receivedMessages: (ContactMessage & { reference: string; receivedAt: string })[] = [];

/** A prefix and six digits, unique among everything received in this process. */
function newReference(prefix: 'NB' | 'NM'): string {
  const used = new Set([...receivedQuotes, ...receivedMessages].map((r) => r.reference));
  let reference: string;
  do {
    reference = `${prefix}-${String(Math.floor(100000 + Math.random() * 900000))}`;
  } while (used.has(reference));
  return reference;
}

/** In-memory implementation of the data contract. Returns copies so callers can't mutate it. */
export const mockApi: SiteApi = {
  async listServices() {
    return structuredClone(services);
  },
  async getService(slug) {
    const service = services.find((s) => s.slug === slug);
    return service ? structuredClone(service) : null;
  },
  async listProjects(options) {
    return structuredClone(pick(projects, options));
  },
  async getProject(slug) {
    const project = projects.find((p) => p.slug === slug);
    return project ? structuredClone(project) : null;
  },
  async listProducts(options) {
    return structuredClone(pick(products, options));
  },
  async getProduct(slug) {
    const product = products.find((p) => p.slug === slug);
    return product ? structuredClone(product) : null;
  },
  async listClients() {
    return structuredClone(clients);
  },
  async submitQuote(request) {
    const reference = newReference('NB');
    receivedQuotes.push({ ...structuredClone(request), reference, receivedAt: new Date().toISOString() });
    return { reference };
  },
  async sendMessage(message) {
    const reference = newReference('NM');
    receivedMessages.push({ ...structuredClone(message), reference, receivedAt: new Date().toISOString() });
    return { reference };
  },
};
