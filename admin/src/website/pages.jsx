import { FileText, Home } from 'lucide-react';
import { Photo, Photos, Repeater, Text } from './fields.jsx';
import { EditorShell, PublishCard, Section, useItem } from './editor.jsx';
import { PageHead } from '../ui.jsx';

/**
 * The home and About pages, section by section: the words and photos of each part. The layout stays
 * the designers' (it lives in the site's components), so nothing here can break a page.
 */

const PAGES = [
  ['home', 'Home page', 'The opening headings, the workshop band, behind the scenes, how a job runs, clients and the closing call to action.', Home, '/'],
  ['about', 'About page', 'The story, how we work, and the workshop photos.', FileText, '/about'],
];

export function PagesIndex() {
  return (
    <>
      <PageHead title="Pages" crumbs={<a href="#/dashboard">Dashboard</a>}>
        The words and photos on the site’s main pages. Projects, services and the shop have their own sections.
      </PageHead>
      <ul className="page-cards">
        {PAGES.map(([slug, name, about, Icon]) => (
          <li key={slug}>
            <a className="card page-card" href={`#/website/pages/${slug}`}>
              <span className="stat-icon" aria-hidden="true">
                <Icon />
              </span>
              <span>
                <strong>{name}</strong>
                <span className="muted">{about}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}

const crumbs = (
  <>
    <a href="#/dashboard">Dashboard</a> / <a href="#/website/pages">Pages</a>
  </>
);
const blankPhoto = { src: '', alt: '' };
const photoOrNull = (p) => (p?.src ? p : null);

/** Sets a key inside one section of the page. */
const field = (ed, section) => (key) => (value) => ed.setDraft((d) => ({ ...d, [section]: { ...d[section], [key]: value } }));

export function PageEditor({ slug, onAuthLost }) {
  const ed = useItem({ kind: 'page', slug, onAuthLost });
  const page = PAGES.find(([s]) => s === slug);
  if (!page) return <p>No such page.</p>;
  return (
    <EditorShell
      ed={ed}
      crumbs={crumbs}
      title={page[1]}
      intro="Each card is one part of the page, top to bottom."
      sitePath={page[4]}
      aside={
        <PublishCard ed={ed}>
          <p className="muted small">Saving updates the page on the website straight away.</p>
          <nav aria-label="Parts of the page" className="jump">
            {(slug === 'home' ? HOME_PARTS : ABOUT_PARTS).map(([id, name]) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={(e) => (e.preventDefault(), document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))}
              >
                {name}
              </a>
            ))}
          </nav>
        </PublishCard>
      }
    >
      {ed.draft && (slug === 'home' ? <HomeForm ed={ed} /> : <AboutForm ed={ed} />)}
    </EditorShell>
  );
}

const HOME_PARTS = [
  ['h-hero', 'Opening headings'],
  ['h-workshop', 'Workshop band'],
  ['h-inhouse', 'Behind the scenes'],
  ['h-process', 'How a job runs'],
  ['h-clients', 'Clients'],
  ['h-cta', 'Call to action'],
];

function HomeForm({ ed }) {
  const d = ed.draft;
  const hero = field(ed, 'hero');
  const workshop = field(ed, 'workshop');
  const inHouse = field(ed, 'inHouse');
  const process = field(ed, 'process');
  const cta = field(ed, 'cta');
  return (
    <>
      <Section title="Opening headings" id="h-hero" hint="Above the newest project (big) and the next four featured projects.">
        <div className="grid two">
          <Text label="First heading" value={d.hero.latestTitle} onChange={hero('latestTitle')} maxLength={40} />
          <Text label="Under it" value={d.hero.latestSubtitle} onChange={hero('latestSubtitle')} maxLength={80} />
          <Text label="Second heading" value={d.hero.discoverTitle} onChange={hero('discoverTitle')} maxLength={40} />
          <Text label="Under it" value={d.hero.discoverSubtitle} onChange={hero('discoverSubtitle')} maxLength={80} />
        </div>
      </Section>
      <Section title="Workshop band" id="h-workshop" hint="A full-width photo with up to three facts below it.">
        <Photo label="Photo" value={photoOrNull(d.workshop.image)} onChange={(v) => workshop('image')(v ?? blankPhoto)} />
        <Text label="Label on the photo" value={d.workshop.caption} onChange={workshop('caption')} maxLength={80} />
        <Repeater
          legend="Facts"
          items={d.workshop.facts}
          onChange={workshop('facts')}
          min={1}
          max={3}
          itemName="Fact"
          addLabel="Add a fact"
          make={() => ({ value: '', label: '' })}
          render={(f, set) => (
            <div className="grid two">
              <Text label="Big words" value={f.value} onChange={(value) => set({ ...f, value })} maxLength={30} hint="e.g. From 10" />
              <Text label="Under them" value={f.label} onChange={(label) => set({ ...f, label })} maxLength={120} />
            </div>
          )}
        />
      </Section>
      <Section title="Behind the scenes" id="h-inhouse">
        <Text label="Small heading" value={d.inHouse.eyebrow} onChange={inHouse('eyebrow')} maxLength={60} />
        <Text label="Heading" value={d.inHouse.title} onChange={inHouse('title')} maxLength={160} />
        <Text label="Text" value={d.inHouse.text} onChange={inHouse('text')} multiline maxLength={600} />
        <Text label="Button" value={d.inHouse.buttonLabel} onChange={inHouse('buttonLabel')} maxLength={40} hint="Goes to the About page." />
        <Photos
          legend="Photos"
          hint="The first is large; the next two sit under it; the fourth sits beside the words on wide screens."
          items={d.inHouse.images}
          onChange={inHouse('images')}
          min={1}
          max={4}
          captions={false}
        />
      </Section>
      <Section title="How a job runs" id="h-process" hint="The dark band of steps. Three to six steps.">
        <Text label="Small heading" value={d.process.eyebrow} onChange={process('eyebrow')} maxLength={60} />
        <Text label="Heading" value={d.process.title} onChange={process('title')} maxLength={160} />
        <Repeater
          legend="Steps"
          items={d.process.steps}
          onChange={process('steps')}
          min={3}
          max={6}
          itemName="Step"
          addLabel="Add a step"
          make={() => ({ name: '', text: '' })}
          render={(s, set) => (
            <>
              <Text label="Name" value={s.name} onChange={(name) => set({ ...s, name })} maxLength={30} />
              <Text label="What happens" value={s.text} onChange={(text) => set({ ...s, text })} multiline rows={2} maxLength={300} />
            </>
          )}
        />
      </Section>
      <Section title="Clients" id="h-clients" hint="The logos come from Website → Clients.">
        <Text label="Heading over the logos" value={d.clients.title} onChange={field(ed, 'clients')('title')} maxLength={80} />
      </Section>
      <Section title="Call to action" id="h-cta" hint="The red block at the end of most pages.">
        <Text label="Small heading" value={d.cta.eyebrow} onChange={cta('eyebrow')} maxLength={60} />
        <Text label="Heading" value={d.cta.title} onChange={cta('title')} maxLength={160} />
        <Text label="Text" value={d.cta.text} onChange={cta('text')} multiline rows={3} maxLength={400} />
      </Section>
    </>
  );
}

const ABOUT_PARTS = [
  ['a-header', 'Top of the page'],
  ['a-story', 'Our story'],
  ['a-principles', 'How we work'],
  ['a-workshop', 'The workshop'],
];

function AboutForm({ ed }) {
  const d = ed.draft;
  const header = field(ed, 'header');
  const principles = field(ed, 'principles');
  const workshop = field(ed, 'workshop');
  return (
    <>
      <Section title="Top of the page" id="a-header">
        <Text label="Heading" value={d.header.title} onChange={header('title')} maxLength={160} />
        <Text label="Introduction" value={d.header.intro} onChange={header('intro')} multiline rows={3} maxLength={600} />
        <Photo label="Wide photo" value={photoOrNull(d.image)} onChange={(v) => ed.set('image')(v ?? blankPhoto)} />
      </Section>
      <Section title="Our story" id="a-story" hint="Large text, one paragraph per box.">
        <Repeater
          legend="Paragraphs"
          items={d.story}
          onChange={ed.set('story')}
          min={1}
          max={6}
          itemName="Paragraph"
          addLabel="Add a paragraph"
          make={() => ''}
          render={(p, set) => <Text label="Text" value={p} onChange={set} multiline rows={3} maxLength={1200} />}
        />
      </Section>
      <Section title="How we work" id="a-principles">
        <Text label="Small heading" value={d.principles.eyebrow} onChange={principles('eyebrow')} maxLength={60} />
        <Text label="Heading" value={d.principles.title} onChange={principles('title')} maxLength={160} />
        <Repeater
          legend="Principles"
          items={d.principles.items}
          onChange={principles('items')}
          min={1}
          max={6}
          itemName="Principle"
          addLabel="Add a principle"
          make={() => ({ title: '', text: '' })}
          render={(p, set) => (
            <>
              <Text label="Title" value={p.title} onChange={(title) => set({ ...p, title })} maxLength={80} />
              <Text label="Text" value={p.text} onChange={(text) => set({ ...p, text })} multiline rows={2} maxLength={400} />
            </>
          )}
        />
      </Section>
      <Section title="The workshop" id="a-workshop">
        <Text label="Small heading" value={d.workshop.eyebrow} onChange={workshop('eyebrow')} maxLength={60} />
        <Text label="Heading" value={d.workshop.title} onChange={workshop('title')} maxLength={160} />
        <Photos legend="Photos" items={d.workshop.photos} onChange={workshop('photos')} min={1} max={8} />
      </Section>
    </>
  );
}
