import { nairobiToday } from '../quote';
import { estimatePrice } from '../pricing';
import { orderCategories, orderProducts } from './data/order-catalogue';
import { products } from './data/products';
import { clients, projects } from './data/projects';
import { services } from './data/services';
import * as orderMock from './mock-orders';
import { OrderError } from './order-types';
import type { ContactMessage, ListOptions, QuoteRequest, SiteApi } from './types';

function pick<T extends { featured: boolean }>(items: T[], { featured, limit }: ListOptions = {}): T[] {
  const filtered = featured === undefined ? items : items.filter((item) => item.featured === featured);
  return limit === undefined ? filtered : filtered.slice(0, limit);
}

/**
 * Quote requests received by the mock, newest last. Lives only as long as the server process;
 * our own backend will store and email them (docs/RUNBOOK.md, Phase 3).
 */
export const receivedQuotes: (QuoteRequest & { reference: string; receivedAt: string })[] = [];

/** Contact-form messages received by the mock, newest last. */
export const receivedMessages: (ContactMessage & { reference: string; receivedAt: string })[] = [];

/** A prefix and six digits, unique among everything received in this process. */
function newReference(prefix: 'NB' | 'NM'): string {
  const used = new Set([...receivedQuotes, ...receivedMessages].map((r) => r.reference).concat([...orderMock.orders.keys()]));
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

  // Online ordering: the rules are in mock-orders.ts.
  async listOrderCategories() {
    return structuredClone(orderCategories);
  },
  async listOrderProducts() {
    return structuredClone(orderProducts);
  },
  async getOrderProduct(slug) {
    const product = orderProducts.find((p) => p.slug === slug);
    return product ? structuredClone(product) : null;
  },
  async priceEstimate(request) {
    const product = orderProducts.find((p) => p.slug === request.product);
    if (!product) throw new OrderError('invalid', 'That item can’t be ordered online.');
    return estimatePrice(product, request, nairobiToday());
  },
  async createOrder(input) {
    return orderMock.createOrder(structuredClone(input), () => newReference('NB'));
  },
  async startPayment(ref, access, phone) {
    return orderMock.startPayment(ref, access, phone);
  },
  async getOrder(ref, access) {
    return orderMock.getOrder(ref, access);
  },
  async approveProof(ref, access, version) {
    return orderMock.approveProof(ref, access, version);
  },
  async requestChanges(ref, access, version, comments) {
    return orderMock.requestChanges(ref, access, version, comments);
  },
  async bookSurvey(ref, access, date) {
    return orderMock.bookSurvey(ref, access, date);
  },
};
