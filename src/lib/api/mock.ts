import { products } from './data/products';
import { clients, projects } from './data/projects';
import { services } from './data/services';
import type { ListOptions, SiteApi } from './types';

function pick<T extends { featured: boolean }>(items: T[], { featured, limit }: ListOptions = {}): T[] {
  const filtered = featured === undefined ? items : items.filter((item) => item.featured === featured);
  return limit === undefined ? filtered : filtered.slice(0, limit);
}

/** In-memory implementation of the data contract. Returns copies so callers can't mutate it. */
export const mockApi: SiteApi = {
  async listServices() {
    return structuredClone(services);
  },
  async listProjects(options) {
    return structuredClone(pick(projects, options));
  },
  async listProducts(options) {
    return structuredClone(pick(products, options));
  },
  async listClients() {
    return structuredClone(clients);
  },
};
