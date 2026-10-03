import { Clients } from '@/components/home/Clients';
import { Hero } from '@/components/home/Hero';
import { InHouse } from '@/components/home/InHouse';
import { Process } from '@/components/home/Process';
import { QuoteCta } from '@/components/home/QuoteCta';
import { ServicesIndex } from '@/components/home/ServicesIndex';
import { ServiceTicker } from '@/components/home/ServiceTicker';
import { ShopTeaser } from '@/components/home/ShopTeaser';
import { WorkshopBand } from '@/components/home/WorkshopBand';
import { api } from '@/lib/api';

export default async function HomePage() {
  const [services, projects, products, clients] = await Promise.all([
    api.listServices(),
    api.listProjects({ featured: true, limit: 5 }),
    api.listProducts({ featured: true, limit: 4 }),
    api.listClients(),
  ]);

  return (
    <>
      <Hero projects={projects} />
      <ServiceTicker services={services} />
      <WorkshopBand />
      <ServicesIndex services={services} />
      <InHouse />
      <Process />
      <Clients clients={clients} />
      <ShopTeaser products={products} />
      <QuoteCta />
    </>
  );
}
