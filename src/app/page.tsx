import { Clients } from '@/components/home/Clients';
import { Hero } from '@/components/home/Hero';
import { InHouse } from '@/components/home/InHouse';
import { Process } from '@/components/home/Process';
import { QuoteCta } from '@/components/home/QuoteCta';
import { SelectedWork } from '@/components/home/SelectedWork';
import { ServicesIndex } from '@/components/home/ServicesIndex';
import { ServiceTicker } from '@/components/home/ServiceTicker';
import { ShopTeaser } from '@/components/home/ShopTeaser';
import { api } from '@/lib/api';

export default async function HomePage() {
  const [services, projects, products, clients] = await Promise.all([
    api.listServices(),
    api.listProjects({ featured: true, limit: 6 }),
    api.listProducts({ featured: true, limit: 4 }),
    api.listClients(),
  ]);

  return (
    <>
      <Hero />
      <ServiceTicker services={services} />
      <SelectedWork projects={projects} services={services} />
      <ServicesIndex services={services} />
      <InHouse />
      <Process />
      <Clients clients={clients} />
      <ShopTeaser products={products} />
      <QuoteCta />
    </>
  );
}
