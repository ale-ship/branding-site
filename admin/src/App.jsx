import {
  BookUser,
  BriefcaseBusiness,
  CreditCard,
  FileText,
  Handshake,
  Images,
  KanbanSquare,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelsTopLeft,
  Search,
  ShoppingBag,
  Tags,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, api, may } from './api.js';
import { ROLE } from './format.js';
import { Accounts, Statement } from './pages/Accounts.jsx';
import { Board } from './pages/Board.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { OrderPage } from './pages/OrderPage.jsx';
import { ProductsPage } from './pages/ProductsPage.jsx';
import { Reports } from './pages/Reports.jsx';
import { SignIn } from './pages/SignIn.jsx';
import { StaffPage } from './pages/StaffPage.jsx';
import { Unmatched } from './pages/Unmatched.jsx';
import { initials } from './ui.jsx';
import { ClientsPage } from './website/clients.jsx';
import { ProjectEditor, ServiceEditor, ServiceList, ShopEditor, ShopList, WorkList } from './website/editors.jsx';
import { MediaLibrary } from './website/media.jsx';
import { PageEditor, PagesIndex } from './website/pages.jsx';

/**
 * The route lives in the hash: #/dashboard, #/orders (?q=…), #/orders/NB-123456, #/payments,
 * #/reports/<kind>, #/accounts, #/accounts/<email>, #/products, #/staff, and the website editor:
 * #/website/pages[/home|about], #/website/work[/<slug>|new], #/website/services[/<slug>],
 * #/website/shop[/<slug>|new], #/website/clients, #/website/media.
 */
function useHashRoute() {
  const read = () => window.location.hash.replace(/^#\/?/, '') || 'dashboard';
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function App() {
  const [staff, setStaff] = useState(undefined);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unmatched, setUnmatched] = useState(0);
  const route = useHashRoute();

  useEffect(() => {
    api
      .get('/staff/me')
      .then((r) => setStaff(r.staff))
      .catch(() => setStaff(null));
  }, []);
  /** Any 401 from a page means the session ended: back to sign-in. */
  const onAuthLost = useCallback(() => setStaff(null), []);
  // Close the drawer on navigation; count unmatched payments for the sidebar badge.
  useEffect(() => setMenuOpen(false), [route]);
  useEffect(() => {
    if (!staff || !may(staff, 'payments')) return;
    api
      .get('/staff/payments/unmatched')
      .then((r) => setUnmatched(r.payments.length))
      .catch((e) => e instanceof ApiError && e.status === 401 && onAuthLost());
  }, [staff, route, onAuthLost]);

  if (staff === undefined)
    return (
      <main>
        <p className="muted">Loading…</p>
      </main>
    );
  if (!staff) return <SignIn onSignedIn={setStaff} />;

  const [path, query = ''] = route.split('?');
  const [page, param, item] = path.split('/');
  // A sidebar link is current when the route is it or under it (#/website/work/… is "Our work").
  const current = (href) => path === href || path.startsWith(`${href}/`);
  const signOut = async () => {
    await api.post('/staff/auth/sign-out').catch(() => {});
    setStaff(null);
  };
  const groups = [
    ['Overview', [['dashboard', 'Dashboard', LayoutDashboard, true]]],
    [
      'Orders',
      [
        ['orders', 'Order board', KanbanSquare, true],
        ['payments', 'Unmatched payments', CreditCard, may(staff, 'payments'), unmatched],
      ],
    ],
    [
      'Finance',
      [
        ['reports', 'Reports', FileText, may(staff, 'finance')],
        ['accounts', 'Customer accounts', BookUser, may(staff, 'finance')],
      ],
    ],
    [
      'Website',
      [
        ['website/pages', 'Pages', PanelsTopLeft, true],
        ['website/work', 'Our work', BriefcaseBusiness, true],
        ['website/services', 'Services', Layers, true],
        ['website/shop', 'Shop', ShoppingBag, true],
        ['website/clients', 'Clients', Handshake, true],
        ['website/media', 'Media library', Images, true],
      ],
    ],
    ['Catalogue', [['products', 'Prices & minimums', Tags, true]]],
    ['Settings', [['staff', 'Staff', Users, staff.role === 'admin']]],
  ];
  const search = (e) => {
    e.preventDefault();
    const q = String(new FormData(e.currentTarget).get('q') ?? '').trim();
    window.location.hash = /^nb-?\d{6}$/i.test(q) ? `#/orders/${q.toUpperCase().replace(/^NB-?/, 'NB-')}` : `#/orders?q=${encodeURIComponent(q)}`;
  };

  return (
    <div className="shell">
      <aside className={`sidebar${menuOpen ? ' open' : ''}`} aria-label="Back office">
        <div className="side-brand">
          <img src={`${import.meta.env.BASE_URL}nb-mark.png`} alt="" />
          <div>
            <strong>Noorcom Branding</strong>
            <span>Back office</span>
          </div>
        </div>
        <nav className="side-nav" aria-label="Back office">
          {groups.map(([group, links]) => {
            const shown = links.filter(([, , , ok]) => ok);
            if (!shown.length) return null;
            return (
              <div key={group}>
                <div className="side-group">{group}</div>
                {shown.map(([href, label, Icon, , count]) => (
                  <a key={href} className="side-link" href={`#/${href}`} aria-current={current(href) ? 'page' : undefined}>
                    <Icon aria-hidden="true" />
                    {label}
                    {count > 0 && (
                      <span className="count">
                        {count}
                        <span className="sr-only"> waiting</span>
                      </span>
                    )}
                  </a>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="side-foot">Signed in as {ROLE[staff.role]}</div>
      </aside>
      {menuOpen && <button type="button" className="scrim" aria-label="Close the menu" onClick={() => setMenuOpen(false)} />}

      <div className="content">
        <header className="topbar">
          <button type="button" className="icon-btn menu-btn" aria-label="Open the menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
            <Menu aria-hidden="true" />
          </button>
          <form className="search" role="search" onSubmit={search}>
            <Search aria-hidden="true" />
            <label className="sr-only" htmlFor="top-search">
              Find an order
            </label>
            <input id="top-search" name="q" type="search" placeholder="Find an order: number, name or phone" />
          </form>
          <div className="top-right">
            <div className="user">
              <span className="avatar" aria-hidden="true">
                {initials(staff.name)}
              </span>
              <span className="user-name">
                <strong>{staff.name}</strong>
                <span>{ROLE[staff.role]}</span>
              </span>
            </div>
            <button type="button" className="icon-btn" onClick={signOut} aria-label="Sign out" title="Sign out">
              <LogOut aria-hidden="true" />
            </button>
          </div>
        </header>
        <main>
          {page === 'dashboard' && <Dashboard onAuthLost={onAuthLost} />}
          {page === 'orders' && param && <OrderPage key={param} orderRef={param} staff={staff} onAuthLost={onAuthLost} />}
          {page === 'orders' && !param && <Board key={query} initialQuery={new URLSearchParams(query).get('q') ?? ''} onAuthLost={onAuthLost} />}
          {page === 'payments' && <Unmatched onAuthLost={onAuthLost} />}
          {page === 'reports' && may(staff, 'finance') && <Reports kind={param} onAuthLost={onAuthLost} />}
          {page === 'accounts' && may(staff, 'finance') && !param && <Accounts onAuthLost={onAuthLost} />}
          {page === 'accounts' && may(staff, 'finance') && param && <Statement key={param} email={decodeURIComponent(param)} onAuthLost={onAuthLost} />}
          {['reports', 'accounts'].includes(page) && !may(staff, 'finance') && <p>Reports and customer accounts are for the admin.</p>}
          {page === 'products' && <ProductsPage me={staff} onAuthLost={onAuthLost} />}
          {page === 'staff' && <StaffPage me={staff} onAuthLost={onAuthLost} />}
          {page === 'website' && <Website key={path} section={param} item={item} me={staff} onAuthLost={onAuthLost} />}
          {!['dashboard', 'orders', 'payments', 'reports', 'accounts', 'products', 'staff', 'website'].includes(page) && (
            <p>
              No such page. <a href="#/dashboard">Back to the dashboard</a>.
            </p>
          )}
        </main>
      </div>
    </div>
  );
}

/** The website editor's pages (owner, 8 Oct 2026: the admin and the designers). */
function Website({ section, item, me, onAuthLost }) {
  const slug = item ? decodeURIComponent(item) : null;
  const props = { onAuthLost };
  switch (section) {
    case 'pages':
      return slug ? <PageEditor slug={slug} {...props} /> : <PagesIndex />;
    case 'work':
      return slug ? <ProjectEditor slug={slug} {...props} /> : <WorkList {...props} />;
    case 'services':
      return slug ? <ServiceEditor slug={slug} {...props} /> : <ServiceList {...props} />;
    case 'shop':
      return slug ? <ShopEditor slug={slug} {...props} /> : <ShopList {...props} />;
    case 'clients':
      return <ClientsPage {...props} />;
    case 'media':
      return <MediaLibrary me={me} {...props} />;
    default:
      return (
        <p>
          No such page. <a href="#/website/pages">Back to the website pages</a>.
        </p>
      );
  }
}
