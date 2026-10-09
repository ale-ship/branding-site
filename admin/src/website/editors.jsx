import { useEffect, useState } from 'react';
import { Chips, Choice, Colours, Num, Photo, Photos, Repeater, slugify, Tags, Text, Toggle } from './fields.jsx';
import { ContentList, EditorShell, Pill, PublishCard, Section, useItem } from './editor.jsx';

/**
 * The editors for our work (projects), the services and the shop, and their lists.
 */

export const SERVICES = [
  ['indoor-branding', 'Indoor branding'],
  ['outdoor-branding', 'Outdoor branding'],
  ['vehicle-branding', 'Vehicle branding'],
  ['apparel', 'Apparel'],
  ['corporate-gifts', 'Corporate gifts'],
  ['stationery', 'Stationery'],
  ['large-format', 'Large format'],
];
const CATEGORIES = [
  ['stationery', 'Stationery'],
  ['print', 'Print'],
  ['apparel', 'Apparel'],
  ['gifts', 'Gifts'],
  ['display', 'Display'],
];
const serviceName = (s) => SERVICES.find(([v]) => v === s)?.[1] ?? s;
const go = (hash) => window.location.replace(hash);

/** The address field, filled from the title until someone types their own. */
function SlugField({ ed, from, prefix }) {
  const [own, setOwn] = useState(!ed.isNew);
  const value = own ? ed.draft.slug : slugify(from);
  const setSlug = ed.set('slug');
  useEffect(() => {
    if (!own && ed.draft.slug !== value) setSlug(value);
  }, [own, value, ed.draft.slug, setSlug]);
  return (
    <Text
      label="Web address"
      value={value}
      onChange={(v) => {
        setOwn(true);
        ed.set('slug')(slugify(v));
      }}
      maxLength={80}
      hint={`noorcombranding.co.ke${prefix}${value || '…'}. Lower-case words and hyphens. Changing it breaks links people have saved.`}
    />
  );
}

// Our work.

const blankProject = () => ({
  slug: '',
  title: '',
  client: '',
  industry: '',
  year: new Date().getFullYear(),
  location: 'Nairobi',
  services: [],
  summary: '',
  cover: { src: '', alt: '' },
  palette: [],
  brief: '',
  idea: '',
  result: '',
  facts: [],
  materials: [],
  applications: [],
  behindTheScenes: [],
  beforeAfter: null,
  featured: false,
  sample: false,
});

export function WorkList({ onAuthLost }) {
  return (
    <ContentList
      kind="project"
      base="work"
      title="Our work"
      intro="The jobs on the website, as case studies. The first five featured ones open the home page; change the order with the arrows."
      addLabel="Add a project"
      photoOf={(d) => d.cover}
      nameOf={(d) => d.title}
      lineOf={(d) => `${d.client} · ${d.year} · ${d.services.map(serviceName).join(', ')}`}
      tags={(it) => (
        <>
          {it.data.featured && <Pill tone="s-ready">Featured</Pill>}
          {it.data.sample && <Pill tone="s-new">Sample: replace before launch</Pill>}
        </>
      )}
      onAuthLost={onAuthLost}
    />
  );
}

export function ProjectEditor({ slug, onAuthLost }) {
  const ed = useItem({
    kind: 'project',
    slug: slug === 'new' ? null : slug,
    blank: blankProject,
    onAuthLost,
    onSaved: (it, created) => (created || it.slug !== slug) && go(`#/website/work/${it.slug}`),
  });
  const d = ed.draft;
  return (
    <EditorShell
      ed={ed}
      crumbs={
        <>
          <a href="#/dashboard">Dashboard</a> / <a href="#/website/work">Our work</a>
        </>
      }
      title={ed.isNew ? 'Add a project' : d?.title || 'Project'}
      intro="A job told as a case study: the brief, the idea, the result and the photos."
      sitePath={d && `/work/${d.slug}`}
      aside={
        d && (
          <>
            <PublishCard ed={ed} what="this project" onDelete={async () => (await ed.remove('this project')) && go('#/website/work')}>
              <Toggle label="Show on the website" checked={ed.published} onChange={ed.setPublished} hint="Off keeps it as a draft only staff see." />
              <Toggle label="Featured" checked={d.featured} onChange={ed.set('featured')} hint="Featured projects open the home page." />
              <Toggle label="Sample" checked={d.sample} onChange={ed.set('sample')} hint="Shows a “Sample” tag. Turn off for real work." />
            </PublishCard>
            {d.cover?.src && (
              <section className="card aside-preview" aria-label="Cover preview">
                <Photo label="Cover photo" value={d.cover} onChange={(v) => ed.set('cover')(v ?? { src: '', alt: '' })} />
              </section>
            )}
          </>
        )
      }
    >
      {d && (
        <>
          <Section title="The basics" id="p-basics">
            <Text
              label="Title"
              value={d.title}
              onChange={ed.set('title')}
              maxLength={160}
              hint="A line that tells the story, e.g. “A delivery fleet you notice from across the road”."
            />
            <SlugField ed={ed} from={d.title} prefix="/work/" />
            <div className="grid two">
              <Text label="Client" value={d.client} onChange={ed.set('client')} maxLength={120} />
              <Text label="Industry" value={d.industry} onChange={ed.set('industry')} maxLength={80} />
              <Num label="Year" value={d.year} onChange={ed.set('year')} min={1990} max={2100} />
              <Text label="Location" value={d.location} onChange={ed.set('location')} maxLength={80} />
            </div>
            <Chips
              legend="Services"
              options={SERVICES}
              value={d.services}
              onChange={ed.set('services')}
              hint="Pick at least one: the project shows on these service pages."
            />
            <Text
              label="Summary"
              value={d.summary}
              onChange={ed.set('summary')}
              multiline
              rows={3}
              maxLength={400}
              hint="One or two sentences for cards and the top of the case study."
            />
          </Section>
          {!d.cover?.src && (
            <Section title="Cover photo" id="p-cover">
              <Photo
                label="Cover photo"
                value={null}
                onChange={(v) => ed.set('cover')(v ?? { src: '', alt: '' })}
                hint="The photo on cards and at the top of the case study."
              />
            </Section>
          )}
          <Section title="The story" id="p-story">
            <Text label="The brief" value={d.brief} onChange={ed.set('brief')} multiline maxLength={3000} hint="What the client needed." />
            <Text label="The idea" value={d.idea} onChange={ed.set('idea')} multiline maxLength={3000} />
            <Text label="The result" value={d.result} onChange={ed.set('result')} multiline maxLength={3000} />
          </Section>
          <Section title="Details" id="p-details">
            <Colours value={d.palette} onChange={ed.set('palette')} />
            <Repeater
              legend="Numbers"
              hint="Short numbers worth bragging about, e.g. “Vans wrapped: 12”."
              items={d.facts}
              onChange={ed.set('facts')}
              max={6}
              itemName="Number"
              addLabel="Add a number"
              make={() => ({ label: '', value: '' })}
              render={(f, set) => (
                <div className="grid two">
                  <Text label="What" value={f.label} onChange={(label) => set({ ...f, label })} maxLength={60} />
                  <Text label="Number" value={f.value} onChange={(value) => set({ ...f, value })} maxLength={30} />
                </div>
              )}
            />
            <Tags label="Materials and finishes" value={d.materials} onChange={ed.set('materials')} max={15} hint="The details a print buyer cares about." />
          </Section>
          <Section title="Photos" id="p-photos" hint="Show the work in use, and how it was made. No people in photos (the owner’s rule).">
            <Photos legend="The work in use" items={d.applications} onChange={ed.set('applications')} itemName="Photo" />
            <Photos legend="Behind the scenes" items={d.behindTheScenes} onChange={ed.set('behindTheScenes')} itemName="Photo" />
            <Toggle
              label="Before and after"
              checked={d.beforeAfter != null}
              onChange={(on) => ed.set('beforeAfter')(on ? { before: { src: '', alt: '' }, after: { src: '', alt: '' } } : null)}
              hint="For rebrands: the old look next to the new."
            />
            {d.beforeAfter && (
              <div className="grid two">
                <Photo
                  label="Before"
                  value={d.beforeAfter.before.src ? d.beforeAfter.before : null}
                  onChange={(v) => ed.set('beforeAfter')({ ...d.beforeAfter, before: v ?? { src: '', alt: '' } })}
                />
                <Photo
                  label="After"
                  value={d.beforeAfter.after.src ? d.beforeAfter.after : null}
                  onChange={(v) => ed.set('beforeAfter')({ ...d.beforeAfter, after: v ?? { src: '', alt: '' } })}
                />
              </div>
            )}
          </Section>
        </>
      )}
    </EditorShell>
  );
}

// Services.

export function ServiceList({ onAuthLost }) {
  return (
    <ContentList
      kind="service"
      base="services"
      title="Services"
      intro="What Noorcom does, each with its own page. Change the words, photo and questions here; the order here is the order on the site."
      photoOf={(d) => d.image}
      nameOf={(d) => d.name}
      lineOf={(d) => `${d.turnaround} · from ${d.minimum.toLowerCase()}`}
      canAdd={false}
      onAuthLost={onAuthLost}
    />
  );
}

export function ServiceEditor({ slug, onAuthLost }) {
  const ed = useItem({ kind: 'service', slug, onAuthLost });
  const d = ed.draft;
  return (
    <EditorShell
      ed={ed}
      crumbs={
        <>
          <a href="#/dashboard">Dashboard</a> / <a href="#/website/services">Services</a>
        </>
      }
      title={d?.name ?? 'Service'}
      intro="The service’s page: what it is, what’s included, how long it takes, and the common questions."
      sitePath={`/services/${slug}`}
      aside={
        d && (
          <PublishCard ed={ed}>
            <p className="muted small">Services are always on the website: each has its own page and links from the menu.</p>
          </PublishCard>
        )
      }
    >
      {d && (
        <>
          <Section title="The basics" id="s-basics">
            <Text label="Name" value={d.name} onChange={ed.set('name')} maxLength={60} />
            <Text label="One line" value={d.summary} onChange={ed.set('summary')} maxLength={200} hint="Shown in lists of services." />
            <Text label="Introduction" value={d.intro} onChange={ed.set('intro')} multiline rows={5} maxLength={1200} />
            <div className="grid two">
              <Text label="Turnaround" value={d.turnaround} onChange={ed.set('turnaround')} maxLength={60} hint="e.g. 3 to 5 working days" />
              <Text label="Smallest job" value={d.minimum} onChange={ed.set('minimum')} maxLength={60} hint="e.g. 10 pieces, or One sign" />
            </div>
          </Section>
          <Section title="Photo" id="s-photo">
            <Photo label="Service photo" value={d.image?.src ? d.image : null} onChange={(v) => ed.set('image')(v ?? { src: '', alt: '' })} />
          </Section>
          <Section title="What’s included" id="s-included">
            <Tags label="Things we make" value={d.includes} onChange={ed.set('includes')} max={20} hint="Shown as tags." />
            <Tags label="Materials" value={d.materials} onChange={ed.set('materials')} max={20} />
            <Chips
              legend="Shop categories"
              options={CATEGORIES}
              value={d.productCategories}
              onChange={ed.set('productCategories')}
              hint="Products from these categories show under “Ready to brand”."
            />
          </Section>
          <Section title="Questions" id="s-faqs">
            <Repeater
              legend="Common questions"
              items={d.faqs}
              onChange={ed.set('faqs')}
              max={15}
              itemName="Question"
              addLabel="Add a question"
              make={() => ({ question: '', answer: '' })}
              render={(f, set) => (
                <>
                  <Text label="Question" value={f.question} onChange={(question) => set({ ...f, question })} maxLength={200} />
                  <Text label="Answer" value={f.answer} onChange={(answer) => set({ ...f, answer })} multiline rows={3} maxLength={1200} />
                </>
              )}
            />
          </Section>
        </>
      )}
    </EditorShell>
  );
}

// The shop.

const blankProduct = () => ({
  slug: '',
  name: '',
  category: 'print',
  service: 'stationery',
  pricePerPiece: 0,
  minQuantity: 10,
  summary: '',
  description: '',
  options: [],
  image: { src: '', alt: '' },
  featured: false,
});

export function ShopList({ onAuthLost }) {
  return (
    <ContentList
      kind="product"
      base="shop"
      title="Shop"
      intro="Ready-to-brand products. Prices and minimums of products on the order form come from Prices & minimums."
      addLabel="Add a product"
      photoOf={(d) => d.image}
      nameOf={(d) => d.name}
      lineOf={(d) => `${CATEGORIES.find(([v]) => v === d.category)?.[1] ?? d.category} · KES ${d.pricePerPiece.toLocaleString('en-KE')} a piece`}
      tags={(it) => it.data.featured && <Pill tone="s-ready">Featured</Pill>}
      onAuthLost={onAuthLost}
    />
  );
}

export function ShopEditor({ slug, onAuthLost }) {
  const ed = useItem({
    kind: 'product',
    slug: slug === 'new' ? null : slug,
    blank: blankProduct,
    onAuthLost,
    onSaved: (it, created) => (created || it.slug !== slug) && go(`#/website/shop/${it.slug}`),
  });
  const d = ed.draft;
  return (
    <EditorShell
      ed={ed}
      crumbs={
        <>
          <a href="#/dashboard">Dashboard</a> / <a href="#/website/shop">Shop</a>
        </>
      }
      title={ed.isNew ? 'Add a product' : d?.name || 'Product'}
      intro="A ready-to-brand product in the shop."
      sitePath={d && `/shop/${d.slug}`}
      aside={
        d && (
          <PublishCard ed={ed} what="this product" onDelete={async () => (await ed.remove('this product')) && go('#/website/shop')}>
            <Toggle label="Show on the website" checked={ed.published} onChange={ed.setPublished} hint="Off keeps it as a draft only staff see." />
            <Toggle label="Featured" checked={d.featured} onChange={ed.set('featured')} hint="Featured products show on the home page." />
          </PublishCard>
        )
      }
    >
      {d && (
        <>
          <Section title="The basics" id="sh-basics">
            <Text label="Name" value={d.name} onChange={ed.set('name')} maxLength={80} />
            <SlugField ed={ed} from={d.name} prefix="/shop/" />
            <div className="grid two">
              <Choice label="Shop category" value={d.category} options={CATEGORIES} onChange={ed.set('category')} />
              <Choice label="Service" value={d.service} options={SERVICES} onChange={ed.set('service')} hint="For turnaround and “how we make it”." />
            </div>
            <Text label="One line" value={d.summary} onChange={ed.set('summary')} maxLength={200} />
            <Text label="Description" value={d.description} onChange={ed.set('description')} multiline rows={4} maxLength={2000} />
          </Section>
          <Section
            title="Price"
            id="sh-price"
            hint="If this product is also on the order form, the website shows the price and minimum from Prices & minimums instead."
          >
            <div className="grid two">
              <Num label="Price per piece" value={d.pricePerPiece} onChange={ed.set('pricePerPiece')} min={0} max={10000000} suffix="KES" />
              <Num label="Minimum order" value={d.minQuantity} onChange={ed.set('minQuantity')} min={1} max={100000} suffix="pieces" />
            </div>
          </Section>
          <Section title="Photo" id="sh-photo">
            <Photo label="Product photo" value={d.image?.src ? d.image : null} onChange={(v) => ed.set('image')(v ?? { src: '', alt: '' })} />
          </Section>
          <Section
            title="Choices"
            id="sh-options"
            hint="What the customer picks on the product page, e.g. Finish: Matte, Gloss. The first value is the default."
          >
            <Repeater
              legend="Choices"
              items={d.options}
              onChange={ed.set('options')}
              max={6}
              itemName="Choice"
              addLabel="Add a choice"
              make={() => ({ name: '', values: [] })}
              render={(o, set) => (
                <>
                  <Text label="Name" value={o.name} onChange={(name) => set({ ...o, name })} maxLength={40} />
                  <Tags label="Values" value={o.values} onChange={(values) => set({ ...o, values })} max={15} />
                </>
              )}
            />
          </Section>
        </>
      )}
    </EditorShell>
  );
}
