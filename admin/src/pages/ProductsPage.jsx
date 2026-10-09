import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from '../api.js';
import { kes } from '../format.js';
import { PageHead } from '../ui.jsx';

/**
 * The price manager (owner, 8 Oct 2026): every quantity-run product on the order form, with its
 * minimum (10 pieces unless set), its price per piece by quantity, and whether it is on sale. The
 * admin changes them; the order form, the price and the shop follow at once. Orders already placed
 * keep their price.
 */
export function ProductsPage({ me, onAuthLost }) {
  const [products, setProducts] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null);
  const canEdit = me.role === 'admin';

  const fail = useCallback((e) => (e instanceof ApiError && e.status === 401 ? onAuthLost() : setError(e.message)), [onAuthLost]);
  useEffect(() => {
    api.get('/staff/products').then((r) => setProducts(r.products), fail);
  }, [fail]);

  const save = async (p, change, message) => {
    setError('');
    setNotice('');
    try {
      const { product } = await api.patch(`/staff/products/${p.slug}`, change);
      setProducts((all) => all.map((x) => (x.slug === p.slug ? product : x)));
      setNotice(message(product));
      return true;
    } catch (err) {
      fail(err);
      return false;
    }
  };

  return (
    <>
      <PageHead title="Prices & minimums" crumbs={<a href="#/dashboard">Dashboard</a>}>
        What each product costs on the order form, by quantity, and the smallest run a customer can order. Changes show on the website at once; orders already
        placed keep their price.
        {canEdit ? '' : ' Only the admin can change them.'}
      </PageHead>
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
        <section className="card">
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Products, their minimums and prices</caption>
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col" className="num">
                    Minimum
                  </th>
                  <th scope="col">Price per piece</th>
                  <th scope="col">On sale</th>
                  {canEdit && (
                    <th scope="col">
                      <span className="sr-only">Change</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {products.map((p) =>
                  editing === p.slug ? (
                    <tr key={p.slug}>
                      <td colSpan={canEdit ? 5 : 4}>
                        <PriceForm
                          p={p}
                          onCancel={() => setEditing(null)}
                          onSave={async (change) => (await save(p, change, (x) => `${x.name} saved.`)) && setEditing(null)}
                        />
                      </td>
                    </tr>
                  ) : (
                    <tr key={p.slug}>
                      <td>
                        <strong>{p.name}</strong>
                        <span className="sub">{p.category}</span>
                      </td>
                      <td className="num">{p.minQuantity.toLocaleString('en-KE')}</td>
                      <td>
                        <ul className="tiers">
                          {p.tiers.map((t) => (
                            <li key={t.minQty}>
                              <span className="muted">{t.minQty.toLocaleString('en-KE')}+</span> {kes(t.unitPrice)}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td>{p.active ? <span className="pill s-ready">On sale</span> : <span className="pill s-closed">Off sale</span>}</td>
                      {canEdit && (
                        <td>
                          <button type="button" onClick={() => setEditing(p.slug)} aria-label={`Change ${p.name}`}>
                            <Pencil aria-hidden="true" />
                            Change
                          </button>
                        </td>
                      )}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

/** One product's minimum, prices and on-sale switch. */
function PriceForm({ p, onSave, onCancel }) {
  const [min, setMin] = useState(p.minQuantity);
  const [tiers, setTiers] = useState(p.tiers);
  const [active, setActive] = useState(p.active);
  const setTier = (i, key, v) => setTiers((all) => all.map((t, j) => (j === i ? { ...t, [key]: v } : t)));
  const id = `price-${p.slug}`;
  return (
    <form
      className="price-form"
      aria-labelledby={`${id}-title`}
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ minQuantity: min, tiers, active });
      }}
    >
      <h2 id={`${id}-title`}>{p.name}</h2>
      <div className="row">
        <div className="field">
          <label htmlFor={`${id}-min`}>Minimum order (pieces)</label>
          <input
            id={`${id}-min`}
            type="number"
            inputMode="numeric"
            min="1"
            max="100000"
            step="1"
            value={min}
            onChange={(e) => setMin(Number(e.target.value))}
            required
          />
        </div>
        <label className="inline-check">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          On sale (shown on the order form)
        </label>
      </div>
      <fieldset className="repeater">
        <legend>Price per piece, by quantity</legend>
        <p className="hint">Each price applies from its quantity up to the next one. The first must start at the minimum or below.</p>
        <ol className="tier-edit">
          {tiers.map((t, i) => (
            <li key={i} className="row tight">
              <div className="field">
                <label htmlFor={`${id}-q${i}`}>From (pieces)</label>
                <input
                  id={`${id}-q${i}`}
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={t.minQty}
                  onChange={(e) => setTier(i, 'minQty', Number(e.target.value))}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor={`${id}-p${i}`}>Price (KES)</label>
                <input
                  id={`${id}-p${i}`}
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={t.unitPrice}
                  onChange={(e) => setTier(i, 'unitPrice', Number(e.target.value))}
                  required
                />
              </div>
              <button
                type="button"
                className="icon-btn small danger"
                onClick={() => setTiers((all) => all.filter((_, j) => j !== i))}
                disabled={tiers.length === 1}
                aria-label={`Remove the price from ${t.minQty} pieces`}
              >
                <Trash2 aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
        {tiers.length < 8 && (
          <button
            type="button"
            className="add-btn"
            onClick={() => setTiers((all) => [...all, { minQty: (all.at(-1)?.minQty ?? min) * 2, unitPrice: all.at(-1)?.unitPrice ?? 1 }])}
          >
            <Plus aria-hidden="true" />
            Add a price for more pieces
          </button>
        )}
      </fieldset>
      <div className="row">
        <button type="submit" className="primary">
          Save prices
        </button>
        <button type="button" className="ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
