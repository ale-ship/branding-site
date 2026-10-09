// @ts-check

/**
 * The words and photos on the home and About pages, section by section. These are the starting
 * values: the backend seeds them into its database, where staff edit them in the back office
 * (Website → Pages); the site's mock serves them as they are. The layout stays in the components.
 *
 * @typedef {import('../contract/content.js').PageContent} PageContent
 */

/** @param {string} name @param {string} alt */
const img = (name, alt) => ({ src: `/images/placeholder/${name}.jpg`, alt });

/** @type {PageContent} */
export const pages = {
  home: {
    hero: {
      latestTitle: 'Latest',
      latestSubtitle: 'Fresh off the press',
      discoverTitle: 'Discover',
      discoverSubtitle: 'From the Noorcom archive',
    },
    workshop: {
      image: img('print-wide-format', 'Our wide-format printer feeding out a long printed banner in the workshop'),
      caption: 'Printed in our Nairobi workshop',
      facts: [
        { value: 'In-house', label: 'Design, print and installation under one roof' },
        { value: 'From 10', label: 'Pieces on most branded items' },
        { value: 'Countrywide', label: 'Installs and delivery across Kenya' },
      ],
    },
    inHouse: {
      eyebrow: 'Behind the scenes',
      title: 'Made in our own workshop, not sent out.',
      text: 'Our designers sit next to our printers. You see a proof before anything is printed, and the people who print it are the ones who install it.',
      buttonLabel: 'About the studio',
      // The large photo first, then the two below it, then the one beside the words (wide screens).
      images: [
        img('print-latex', 'A wide-format latex printer in the print room'),
        img('apparel-press', 'A yellow t-shirt laid on the press, ready to print'),
        img('press-offset', 'An offset press with its ink rollers'),
        img('screen-inks', 'Tubs of screen-printing ink on the workbench'),
      ],
    },
    // TODO(business): confirm the steps and typical turnaround with Noorcom.
    process: {
      eyebrow: 'How a job runs',
      title: 'From brief to installed, in five steps',
      steps: [
        { name: 'Brief', text: 'Tell us what you need, how many and by when. We reply the same working day.' },
        { name: 'Design', text: 'Our studio designs it, or prepares your artwork so it prints perfectly.' },
        { name: 'Proof', text: 'You approve a digital proof, or a physical sample for bigger runs.' },
        { name: 'Print', text: 'Made in our workshop on our own machines, checked piece by piece.' },
        { name: 'Install', text: 'Delivered or installed by the same team, anywhere in Kenya.' },
      ],
    },
    clients: { title: 'Trusted by teams across Kenya' },
    cta: {
      eyebrow: 'Start a job',
      title: 'Have a job in mind?',
      text: 'Send us the brief, the quantity and your deadline. We’ll come back with a price and a proof.',
    },
  },
  // TODO(business): Noorcom to confirm or rewrite the story and the principles.
  about: {
    header: {
      title: 'A design studio and a print workshop under one roof',
      intro: 'Noorcom Branding designs, prints and installs branding for businesses across Kenya, from a box of business cards to a fleet of vans.',
    },
    image: img('print-wide-format', 'Our wide-format printer feeding out a printed banner'),
    story: [
      'Most businesses we meet have been passed between a designer, a printer and an installer, and the job got worse at every hand-over. We built Noorcom so it doesn’t.',
      'Our studio and our workshop share a floor on Loita Street. We design it, print it on our own machines and install it ourselves, so the sign on your wall looks like the one you approved.',
    ],
    principles: {
      eyebrow: 'How we work',
      title: 'Three things we don’t compromise on',
      items: [
        {
          title: 'One team, start to finish',
          text: 'The designer who draws your sign talks to the printer who prints it and the installer who fits it. Nothing gets lost in between.',
        },
        {
          title: 'A proof before anything is printed',
          text: 'You see exactly what you’re getting, on screen or as a sample, and nothing runs until you say yes.',
        },
        {
          title: 'Made to last',
          text: 'UV-resistant inks, cast vinyls, proper laminates. We’d rather do the job once than redo it next rainy season.',
        },
      ],
    },
    workshop: {
      eyebrow: 'The workshop',
      title: 'The machines behind the work',
      photos: [
        { ...img('print-latex', 'A latex printer in the print room'), caption: 'Wide-format latex printing' },
        { ...img('press-offset', 'An offset press with its ink rollers'), caption: 'Offset press for long runs' },
        { ...img('apparel-press', 'A yellow t-shirt on the press'), caption: 'Apparel printing' },
        { ...img('screen-inks', 'Tubs of screen-printing ink'), caption: 'Inks mixed to your colours' },
      ],
    },
  },
};
