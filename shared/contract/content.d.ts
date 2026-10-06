/** Content types the order contract refers to (the site's other content types stay in the site). */

/** A photo in public/images. `alt` describes it for screen readers. */
export type Photo = { src: string; alt: string };

export type ServiceSlug =
  | 'indoor-branding'
  | 'outdoor-branding'
  | 'vehicle-branding'
  | 'apparel'
  | 'corporate-gifts'
  | 'stationery'
  | 'large-format';

/** A file the customer picked. Only the name, size and type travel until uploads go to storage. */
export type ArtworkFile = { name: string; size: number; type: string };
