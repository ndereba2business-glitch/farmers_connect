// The photographs on the landing page: where each came from, who made it,
// the licence it is used under, and how it is cropped. Read by the page
// (LandingPhoto.jsx, LandingFooter.jsx) and by scripts/build-landing-images.mjs,
// which makes the files in public/landing/. No imports, so both can use it.
//
// RULES FOR THIS FILE
//   - Real photographs of real poultry farming only. No stock library
//     images and nothing generated.
//   - Only a licence that allows commercial use: CC0, CC BY or CC BY-SA.
//     Not "NC" (non-commercial), and not an image merely found on
//     Pinterest, Google Images or social media, which grants no licence.
//   - No photograph in which a person can be recognised, unless that
//     person has agreed in writing to appear on this page. A licence
//     covers the photographer's copyright, not the subject's consent.
//   - `sha1` pins the exact file whose licence was checked; the build
//     script refuses a file that has changed on Commons.
//   - CC BY and CC BY-SA require credit. The footer prints `credit` for
//     every photograph here, with links to the source and the licence.

export const PHOTO_WIDTHS = [480, 800, 1200];

export const PHOTOS = [
  {
    id: "kienyeji-hens",
    alt: "Improved kienyeji hens and a cockerel at a wire fence, reaching for a handful of fresh greens",
    commonsTitle: "File:Improved Kenyan Kienyeji Chickens.jpg",
    source: "https://commons.wikimedia.org/wiki/File:Improved_Kenyan_Kienyeji_Chickens.jpg",
    sha1: "e0c9fc40100e18c0db42a65706a4b64e0d6d1570",
    author: "Yganyana",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    changes: "cropped and resized",
    ratio: 4 / 5,
    focus: [0.5, 0.34]
  },
  {
    id: "chick-drinking",
    alt: "A week-old chick stretching up after drinking from a bowl of water",
    commonsTitle: "File:Week old chick drinking water in Kenya.jpg",
    source: "https://commons.wikimedia.org/wiki/File:Week_old_chick_drinking_water_in_Kenya.jpg",
    sha1: "2367c43802dae550d99bea4bb54220fa80daba51",
    author: "Yganyana",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    changes: "cropped and resized",
    ratio: 4 / 3,
    focus: [0.56, 0.5]
  },
  {
    id: "brooder",
    alt: "Young chicks in a round plywood brooder on wood shavings, with a feeder and a drinker",
    commonsTitle: "File:Feeding chics.jpg",
    source: "https://commons.wikimedia.org/wiki/File:Feeding_chics.jpg",
    sha1: "8cef3c6baa789346f600ae21f1ee7082c811b774",
    author: "Anitah Pezz",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    changes: "cropped and resized",
    ratio: 4 / 3,
    focus: [0.5, 0.5]
  },
  {
    id: "fresh-eggs",
    alt: "Three freshly collected eggs held in an open hand",
    commonsTitle: "File:Farm-freah eggs from Kenya.jpg",
    source: "https://commons.wikimedia.org/wiki/File:Farm-freah_eggs_from_Kenya.jpg",
    sha1: "80c18428bc1e478fb0635baa02d9779b1f212f7d",
    author: "Yganyana",
    licence: "CC0 1.0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    changes: "cropped and resized",
    ratio: 1,
    focus: [0.5, 0.46]
  }
];

export const photoById = (id) => PHOTOS.find(p => p.id === id);
