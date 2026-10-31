# Icon and OG image sources

The mark is a play triangle flying off like a paper plane, with two motion lines: "ブーン" from the name Liveeen (ライブーン). The owner picked it on 2026-10-31 from three ChatGPT drafts; it was redrawn here as vector paths so the color is exactly `#e11d55` and the mark is centered.

| Source                  | Output                                                       | How                                                                                                 |
| ----------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `src/app/icon.svg`      | itself, and the 32 and 48 px frames of `src/app/favicon.ico` | Render at 1024 px in Chrome, resize with Pillow, save the `.ico` with the frames in `append_images` |
| `design/favicon-16.svg` | the 16 px frame of `src/app/favicon.ico`                     | The same. No motion lines and a larger triangle: at 16 px the lines blurred into the triangle       |
| `design/apple-icon.svg` | `src/app/apple-icon.png` (180)                               | Render at 1024 px in Chrome, resize with Pillow                                                     |
| `design/og.html`        | `src/app/opengraph-image.png` (1200×630)                     | Open in Chrome at 1200×630 and take a screenshot                                                    |

`unbounded-bold-logo.ttf` is Unbounded Bold (SIL Open Font License) cut down by Google Fonts to the letters of "Liveeen", for `og.html`.

The paths are the same in all the files; change them together.
