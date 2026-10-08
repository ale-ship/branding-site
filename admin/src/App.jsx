import { useCallback, useEffect, useState } from 'react';
import { ApiError, api, may } from './api.js';
import { ROLE } from './format.js';
import { Board } from './pages/Board.jsx';
import { OrderPage } from './pages/OrderPage.jsx';
import { ProductsPage } from './pages/ProductsPage.jsx';
import { SignIn } from './pages/SignIn.jsx';
import { StaffPage } from './pages/StaffPage.jsx';
import { Unmatched } from './pages/Unmatched.jsx';

/** The route lives in the hash: #/orders, #/orders/NB-123456, #/payments, #/products, #/staff. */
function useHashRoute() {
  const read = () => window.location.hash.replace(/^#\/?/, '') || 'orders';
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
  const route = useHashRoute();

  const load = useCallback(() => {
    api
      .get('/staff/me')
      .then((r) => setStaff(r.staff))
      .catch((e) => (e instanceof ApiError && e.status === 401 ? setStaff(null) : setStaff(null)));
  }, []);
  useEffect(load, [load]);

  /** Any 401 from a page means the session ended: back to sign-in. */
  const onAuthLost = useCallback(() => setStaff(null), []);

  if (staff === undefined) return <main><p className="muted">Loading…</p></main>;
  if (!staff) return <SignIn onSignedIn={setStaff} />;

  const [page, param] = route.split('/');
  const signOut = async () => {
    await api.post('/staff/auth/sign-out').catch(() => {});
    setStaff(null);
  };
  const nav = [
    ['orders', 'Orders', true],
    ['payments', 'Unmatched payments', may(staff, 'payments')],
    ['products', 'Products', true],
    ['staff', 'Staff', staff.role === 'admin'],
  ];

  return (
    <>
      <header className="top">
        <div className="top-inner">
          <span className="brand">Noorcom Branding · Back office</span>
          <nav aria-label="Back office">
            {nav
              .filter(([, , shown]) => shown)
              .map(([href, label]) => (
                <a key={href} href={`#/${href}`} aria-current={page === href ? 'page' : undefined}>
                  {label}
                </a>
              ))}
          </nav>
          <span className="who">
            {staff.name} · {ROLE[staff.role]}
          </span>
          <a href="#/orders" onClick={(e) => (e.preventDefault(), signOut())}>
            Sign out
          </a>
        </div>
      </header>
      <main>
        {page === 'orders' && param && <OrderPage key={param} orderRef={param} staff={staff} onAuthLost={onAuthLost} />}
        {page === 'orders' && !param && <Board onAuthLost={onAuthLost} />}
        {page === 'payments' && <Unmatched onAuthLost={onAuthLost} />}
        {page === 'products' && <ProductsPage me={staff} onAuthLost={onAuthLost} />}
        {page === 'staff' && <StaffPage me={staff} onAuthLost={onAuthLost} />}
        {!['orders', 'payments', 'products', 'staff'].includes(page) && <p>No such page. <a href="#/orders">Back to the orders</a>.</p>}
      </main>
    </>
  );
}
