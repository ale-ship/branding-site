import { nairobiToday } from '../quote';
import { estimatePrice } from '../pricing';
import { orderCategories, orderProducts } from './data/order-catalogue';
import { pages } from './data/pages';
import { products } from './data/products';
import { clients, projects } from './data/projects';
import { services } from './data/services';
import * as accountMock from './mock-accounts';
import * as orderMock from './mock-orders';
import { OrderError } from './order-types';
import type { ContactMessage, ListOptions, QuoteRequest, SiteApi } from './types';
import { shared } from './mock-store';

function pick<T extends { featured: boolean }>(items: T[], { featured, limit }: ListOptions = {}): T[] {
  const filtered = featured === undefined ? items : items.filter((item) => item.featured === featured);
  return limit === undefined ? filtered : filtered.slice(0, limit);
}

/**
 * Quote requests received by the mock, newest last. Lives only as long as the server process;
 * our own backend will store and email them (docs/RUNBOOK.md, Phase 3).
 */
export const receivedQuotes = shared('receivedQuotes', (): (QuoteRequest & { reference: string; receivedAt: string })[] => []);

/** Contact-form messages received by the mock, newest last. */
export const receivedMessages = shared('receivedMessages', (): (ContactMessage & { reference: string; receivedAt: string })[] => []);

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
  async getPageContent() {
    return structuredClone(pages);
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
  async getCapacity() {
    return orderMock.capacityCalendar();
  },
  async priceEstimate(request) {
    const product = orderProducts.find((p) => p.slug === request.product);
    if (!product) throw new OrderError('invalid', 'That item can’t be ordered online.');
    return estimatePrice(product, request, nairobiToday(), orderMock.capacityCalendar());
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
  async approveProof(ref, access, version, checklist) {
    return orderMock.approveProof(ref, access, version, checklist);
  },
  async requestChanges(ref, access, version, comments, pins) {
    return orderMock.requestChanges(ref, access, version, comments, pins);
  },
  async reviewSample(ref, access, decision, comments) {
    return orderMock.reviewSample(ref, access, decision, comments);
  },
  async requestPartialDelivery(ref, access, pieces) {
    return orderMock.requestPartialDelivery(ref, access, pieces);
  },
  async bookSurvey(ref, access, date) {
    return orderMock.bookSurvey(ref, access, date);
  },
  async acceptSiteQuote(ref, access) {
    return orderMock.acceptSiteQuote(ref, access);
  },
  async bookInstall(ref, access, date) {
    return orderMock.bookInstall(ref, access, date);
  },
  // Accounts: the rules are in mock-accounts.ts.
  async requestSignInCode(phone) {
    return accountMock.requestSignInCode(phone);
  },
  async verifySignInCode(phone, code) {
    return accountMock.verifySignInCode(phone, code);
  },
  async getAccount(session) {
    return accountMock.getAccount(session);
  },
  async updateAccount(session, details) {
    return accountMock.updateAccount(session, details);
  },
  async saveBrandKit(session, kit) {
    return accountMock.saveBrandKit(session, kit);
  },
  async saveAddress(session, address) {
    return accountMock.saveAddress(session, address);
  },
  async removeAddress(session, id) {
    return accountMock.removeAddress(session, id);
  },
  async reorderDraft(session, ref) {
    return accountMock.reorderDraft(session, ref);
  },
  async signOut(session) {
    accountMock.signOut(session);
  },
  async getStatement(session) {
    return accountMock.getStatement(session);
  },
  async createCompany(session, details) {
    return accountMock.createCompany(session, details);
  },
  async addCompanyMember(session, member) {
    return accountMock.addCompanyMember(session, member);
  },
  async removeCompanyMember(session, phone) {
    return accountMock.removeCompanyMember(session, phone);
  },
};
