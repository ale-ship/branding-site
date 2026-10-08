import { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from '../api.js';
import { kes } from '../format.js';

/**
 * Quantity-run products and their minimums (owner, 8 Oct 2026: 10 pieces unless set here). Every
 * staff member can look; admins change a minimum, which the site's order form uses at once.
 */
export function ProductsPage({ me, onAuthLost }) {
  const [products, setProducts] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const canEdit = me.role === 'admin';

  const fail = useCallback((e) => (e instanceof ApiError && e.status === 401 ? onAuthLost() : setError(e.message)), [onAuthLost]);
  useEffect(() => {
    api.get('/staff/products').then((r) => setProducts(r.products)).catch(fail);
  }, [fail]);

  const save = async (e, p) => {
    e.preventDefault();
    const minQuantity = Number(new FormData(e.currentTarget).get('min'));
    setError('');
    setNotice('');
    try {
      const { product } = await api.patch(`/staff/products/${p.slug}`, { minQuantity });
      setProducts((all) => all.map((x) => (x.slug === p.slug ? product : x)));
      setNotice(`${p.name}: the minimum is now ${product.minQuantity.toLocaleString('en-KE')} pieces.`);
    } catch (err) {
      fail(err);
    }
  };

  return (
    <>
      <h1>Products</h1>
      <p className="muted">
        The smallest run a customer can order online. New orders and prices follow a change at once; orders already placed keep their quantity.
        {canEdit ? '' : ' Only admins can change a minimum.'}
      </p>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!products && !error && <p className="muted">Loading…</p>}
      {products && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Price per piece</th>
                <th scope="col">Minimum (pieces)</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.slug}>
                  <td>
                    {p.name}
                    <div className="muted">
                      {p.category}
                      {p.active ? '' : ' · not on sale'}
                    </div>
                  </td>
                  <td className="muted">
                    {p.tiers.map((t) => `${kes(t.unitPrice)} from ${t.minQty.toLocaleString('en-KE')}`).join('; ')}
                  </td>
                  <td>
                    {canEdit ? (
                      <form className="row" onSubmit={(e) => save(e, p)}>
                        <div className="field" style={{ flex: '0 1 7rem' }}>
                          <label className="sr-only" htmlFor={`min-${p.slug}`}>
                            Minimum for {p.name}
                          </label>
                          <input id={`min-${p.slug}`} name="min" type="number" inputMode="numeric" min="1" max="100000" step="1" defaultValue={p.minQuantity} required />
                        </div>
                        <button type="submit">Save</button>
                      </form>
                    ) : (
                      p.minQuantity.toLocaleString('en-KE')
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
