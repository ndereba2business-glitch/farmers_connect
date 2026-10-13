# Photographs on the landing page: sources and licences

Every photograph used by the app, where it came from, what its licence allows, and what remains for the
owner to decide. The machine-readable copy of this record is `src/components/landing/photos.js`; the page's
footer prints the credits from it, and `scripts/build-landing-images.mjs` refuses to rebuild from a file
whose content has changed since its licence was checked.

Checked on 12 and 13 October 2026 against the licence data Wikimedia Commons publishes for each file.

## What is used

| Photograph (file on this site) | Where on the page | Source | Author | Licence | Credit required? | Changes made |
| --- | --- | --- | --- | --- | --- | --- |
| Improved kienyeji hens at a wire fence (`kienyeji-hens`) | Hero | [Improved Kenyan Kienyeji Chickens](https://commons.wikimedia.org/wiki/File:Improved_Kenyan_Kienyeji_Chickens.jpg) | Yganyana | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Yes | Cropped to 4:5, resized |
| A week-old chick at a bowl of water (`chick-drinking`) | Community | [Week old chick drinking water in Kenya](https://commons.wikimedia.org/wiki/File:Week_old_chick_drinking_water_in_Kenya.jpg) | Yganyana | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Yes | Cropped to 4:3, resized |
| Chicks in a round brooder (`brooder`) | My Farm | [Feeding chics](https://commons.wikimedia.org/wiki/File:Feeding_chics.jpg) | Anitah Pezz | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Yes | Cropped to 4:3, resized |
| Three eggs in an open hand (`fresh-eggs`) | Marketplace | [Farm-freah eggs from Kenya](https://commons.wikimedia.org/wiki/File:Farm-freah_eggs_from_Kenya.jpg) | Yganyana | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | No (credited anyway) | Cropped square, resized |

All four are the photographers' own work, uploaded by them to Wikimedia Commons; three were entries in the
Wiki Loves Africa competition and are categorised by Commons as taken in Kenya. None shows a recognisable
person: two show part of a hand.

The exact files are pinned by their SHA-1 in `photos.js`.

## What the licences require, and how the page meets it

**CC BY-SA 4.0** allows copying, changing and commercial use, on three conditions:

| Condition | How it is met |
| --- | --- |
| Credit the author, link the licence, and say if changes were made | The footer of the landing page lists each photograph with its title (linked to the source), author, licence (linked) and "cropped and resized". A test checks this (`tests/e2e/landing.test.js`) |
| Share adaptations under the same licence | The cropped, resized files in `public/landing/` are adaptations and are offered under CC BY-SA 4.0. This applies to those image files only, not to the app, its code or its other content |
| No extra restrictions | Nothing prevents anyone from saving and reusing those files |

**CC0 1.0** places no conditions. The eggs photograph is credited anyway.

## How the files were made

- `node scripts/build-landing-images.mjs` downloads each photograph from Commons, checks it is the pinned
  file, crops it around a chosen focal point and writes WebP at 480, 800 and 1200 pixels wide plus one JPEG.
- Sizes: the 480-pixel files are 10 to 45 KB, which is what a phone downloads. The largest file is 227 KB.
- The files are committed to the repository and served from the app's own address. **Nothing is
  hot-linked**: the page does not depend on Commons, or any other site, being reachable. A test checks that
  no image request leaves the site.
- Each `<img>` declares its width and height, so the space is reserved before the photograph arrives.
  Measured layout shift while loading is below 0.05.

## What was looked at and not used

| Candidate | Why not |
| --- | --- |
| Photographs found through Pinterest | Pinterest is a collection of other people's images and grants no licence to reuse them. Nothing was taken from it. It was not used as a source at all |
| [AUSAID KENYA (10671724855)](https://commons.wikimedia.org/wiki/File:AUSAID_KENYA_(10671724855).jpg), a named farmer feeding hens near Gilgil, CC BY 2.0 | The licence covers the photographer's copyright, not the farmer's agreement to appear in an advertisement for a product. A clearly identifiable, named person |
| [Chicken feeds](https://commons.wikimedia.org/wiki/File:Chicken_feeds.jpg), a woman feeding free-range chickens in Kericho, CC BY-SA 4.0 | Same reason: an identifiable person |
| [Feeding Chickens](https://commons.wikimedia.org/wiki/File:Feeding_Chickens.jpg), a farmer in a layer house in Murang'a, CC BY-SA 4.0 | Same reason, though the face is partly covered |
| [TEAR in Kenya](https://commons.wikimedia.org/wiki/File:TEAR_in_Kenya_(10728587785).jpg), CC BY 2.0 | Identifiable people |
| Photographs by ILRI (International Livestock Research Institute) | Many are licensed CC BY-NC-SA. "NC" forbids commercial use |
| A 2026 upload described as a farmer tending chicks, CC0 | Its description reads like a caption written for a generated image. Not used because its authenticity could not be confirmed |
| Stock photography sites | The project's own rule: real photographs of real farms, never stock |

## Gaps: what the brief asked for and is not on the page

No suitably licensed photograph without identifiable people was found for:

- **a vet examining birds**;
- **farmers learning or working together**;
- **a supplier, an agrovet shop or feed store**;
- **broilers in a clean, well-run house** (the photographs found show kienyeji and layer birds).

These are the pictures that would do most for trust, and they are best taken, not found.

## For the owner

1. **Best next step: your own photographs.** A dozen phone photographs from two or three real member
   farms, a vet visit and a supplier's shop, taken with each person's written agreement, would be better
   than anything above. A one-line consent is enough: name, date, "I agree that Farmers Connect may use
   this photograph of me on its website and app store listing", signature. Keep the forms.
2. **Decide about people.** If you want a photograph of an identifiable person from Commons, contact the
   photographer and the subject first. This is a rights question no licence tag answers.
3. **Keep the credits.** If a photograph is replaced, update `photos.js`; the footer follows. Removing the
   credit while keeping a CC BY-SA photograph would breach its licence.
4. **Play Store graphics are separate.** The store's feature graphic and screenshots should be the app's own
   screens and brand mark. If one of these photographs is used there, the same credit is needed in the
   listing description.
5. **A caution on certainty.** Commons records what uploaders declare. It is the best public evidence
   available and is widely relied on, but it is not a guarantee that an uploader had the right to license a
   file. Your own photographs remove that doubt.
