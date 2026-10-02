# Catalog Transformer one-pager

A single-page, A4 portrait product brief with an Excel → human rules → Laya transformer → reviewed Excel workflow, a conceptual neural-network illustration, a worked rule mapping, review controls, and local-first benefits. The standalone HTML includes its fonts and styles and does not need a server or internet connection.

## Deliverables

- `Catalog-Transformer-One-Pager.pdf`: shareable, searchable A4 PDF.
- `Catalog-Transformer-One-Pager.html`: self-contained offline web version; includes a native Print / save PDF button.
- `Catalog-Transformer-One-Pager.png`: desktop preview.
- `print-preview.png`: independent rasterization of the PDF used for visual verification.
- `mobile-preview.png`: responsive HTML preview at a 390-pixel viewport.

The app and installer are not modified by this document.

## Edit and rebuild

Edit `template.html` for copy and SVG illustrations, and `styles.css` for layout. The fonts and their original SIL Open Font Licenses are in `assets/`. The generated HTML also embeds the license text. Do not edit the generated deliverables directly.

From the project root:

```powershell
node docs/one-pager/export.mjs
```

Requires Node.js 22 or later and Microsoft Edge or Google Chrome. It uses Node's built-in APIs, not project dependencies. Set `ONE_PAGER_BROWSER` if the Chromium executable is installed elsewhere. The exporter opens only an isolated, hidden, temporary browser profile and closes its own process; it does not change the user's browser or installed app. The profile stays in the OS temporary directory.

To produce only the standalone HTML, without launching a browser:

```powershell
node docs/one-pager/export.mjs --html-only
```

The full export checks that the PDF contains exactly one page, fonts load offline, the print control works, and text and page bounds fit desktop, print, and seven responsive widths (320, 390, 600, 650, 768, 900 and 1024 pixels). Results are written to `validation.json`. Animations stop for print and for reduced-motion preferences. Accept / Exclude are labeled illustrations, not nonfunctional interactive buttons.

`print-preview.png` and `pdf-validation.json` record an additional independent PDF inspection with PyMuPDF, outside the normal export script. Regenerate them after document changes before treating that inspection as current.

## Copy and claim boundaries

Checked against the project on October 2, 2026:

| Wording | Basis and limits |
| --- | --- |
| Laya, not Layla | `models/laya-multilingual/manifest.json` names `convaiinnovations/laya/multilingual`; this is the engine bundled by this project. |
| Local neural intent approval, then exact row checks | `README.md` and `src/renderer/README.md` describe required Laya intent approval and deterministic evaluation. The network illustration is conceptual, not the literal model architecture. |
| Plain-language rules; title, rule, flag, action | The current rule workflow maps supported intent, columns, priorities and actions. The contact rule on the page is an illustrative mapping, not a fabricated live app result. Unsupported or uncertain instructions must be revised. |
| Reviewed Excel, not automatic repairs | The exporter preserves original values. Clean rows and explicitly accepted flagged rows are included, pending and excluded flagged rows are omitted, and actions, priorities and red error cells are retained. Worksheet-level issues are a separate export sheet. |
| No external reference sheets | Current rules work with the selected dataset, explicit conditions and built-in validators. The page does not promise external-directory verification. |
| Open-source AI engine | `vendor/laya-ts/LICENSE` and its `package.json` identify Apache 2.0. The app itself is marked `UNLICENSED` and private in the root `package.json`; the document does not claim that the entire app is open source. |
| An alternative to Jev | The pinned Laya upstream README documents a Jev-compatible decision API. Laya is not described as an official open-source edition of Jev. |
| $0 token fees; no hosted backend | Local model inference and local row checks do not require a hosted inference API or backend. Device, storage, memory, energy and any organizational support costs still exist. No universal cheapest/fastest claim or unverified latency is used. |
| Offline Windows installer | `release-laya/Catalog-Transformer-0.1.1-x64.exe` exists, with the bundled local-model release described in the project documentation. |
| Portable build option | The root `package.json` configures a `portable` script. A portable executable with the bundled model has not been independently verified here. The page states that the verified release is the offline installer. |

## Upstream provenance

The official README was retrieved at the exact runtime revision stored in the local model manifest:

```text
https://raw.githubusercontent.com/NandhaKishorM/laya/6d942c92081fbc139e736bbd9ac0023223c29b7f/README.md
```

Font binaries were copied unchanged from the existing app's `out/renderer/assets/` (Latin Fraunces and Source Sans 3 subsets). Their original licenses were retrieved from the corresponding Google Fonts directories:

```text
https://raw.githubusercontent.com/google/fonts/main/ofl/fraunces/OFL.txt
https://raw.githubusercontent.com/google/fonts/main/ofl/sourcesans3/OFL.txt
```
