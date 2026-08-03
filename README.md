# Offline Resume Builder

A frontend-only, offline-first resume builder. Your resume lives as a single git-diff-friendly JSON file, renders live into an ATS-friendly template, and exports to PDF via the browser's native print — no server, no account, no analytics, nothing ever leaves your browser.

**Live demo:** https://luviein.github.io/resumebuilder/

## Why

Most resume builders are SaaS products that store your data on a server and export bloated, image-based PDFs that applicant tracking systems (ATS) can't parse. This is the opposite: a static site that works with zero network connection, keeps your resume as plain JSON you can track in git like code, and prints to a PDF with real, selectable, ATS-parseable text.

## Features

- **Offline-first / installable PWA** — after the first load, the app works with no network at all, and can be installed to your home screen or desktop.
- **Privacy-first** — no server, no analytics, no tracking. Your resume data only ever lives in your browser's `localStorage`.
- **Git-diff-friendly source of truth** — the resume is a single JSON file: `basics` plus an extensible `sections[]` array. Any section can be an `entries` list (jobs, degrees, projects), a `skills` list, or free-form `text` — so custom sections (Certifications, Awards, Publications, ...) work with no code changes. Older resume.json files using the original fixed `work`/`education`/`skills`/`projects` fields still load correctly — they're migrated automatically.
- **Two ways to edit** — a raw JSON **Source** view for full control, or a dynamic **Form** view (add/remove/reorder sections and entries with plain fields) — both stay in sync with each other.
- **Format text inline** — select text in the live preview (summary, bullets, custom text sections) to bold/italicize it with a small floating toolbar. Stored as plain `**bold**`/`_italic_` markup in the JSON, not rich-text objects, so it stays diff-friendly.
- **Multiple templates** — switch between templates from a dropdown; your data isn't tied to any one look.
- **True-to-print preview** — the preview always renders at real A4 proportions (scaling down to fit narrow screens, never distorting), and an "Auto-fit to page" button shrinks spacing/font size until your resume fits one page.
- **ATS-friendly export** — "Export to PDF" uses the browser's native print, producing a PDF with real selectable text (not a rasterized screenshot), which is what makes it parseable by applicant tracking systems.
- **Import an existing resume** — upload a PDF, DOCX, or JSON file and it's parsed (heuristically, for PDF/DOCX) straight into the structured format, so you don't have to start from a blank file. Best-effort: PDF/DOCX imports are flagged for review since real-world resume layouts vary a lot.
- **Style customization** — control page margin, spacing, line-height, and font/size/color independently for the header, section headings, and body text, from a small floating panel. Settings persist locally and apply identically to the printed/exported PDF.
- **Mobile-friendly** — responsive layout with a tab-switched editor/preview view on narrow screens.

## Tech stack

- **[Vite](https://vitejs.dev/)** + **TypeScript**, no UI framework — the app is a JSON editor, a generated form, and a live-rendered preview, which doesn't need one.
- **[vite-plugin-pwa](https://vite-pwa-org.netlify.app/)** for the offline service worker and installable manifest.
- **[pdfjs-dist](https://mozilla.github.io/pdf.js/)** and **[mammoth](https://github.com/mwilliamson/mammoth.js)** for client-side PDF/DOCX text extraction (both lazy-loaded — they're not part of the base app bundle).
- **[Vitest](https://vitest.dev/)** for unit tests.

No backend, no external API calls, no analytics — anywhere.

## Quick start

Try it live with zero setup: **https://luviein.github.io/resumebuilder/** — or run it locally:

```bash
git clone https://github.com/luviein/resumebuilder.git
cd resumebuilder
npm install
npm run dev
```

Open the printed local URL (typically `http://localhost:5173`). A sample resume loads automatically so there's something to explore right away.

### A short tour

1. **Start on the Form tab.** Edit the sample data with plain fields — no JSON required. Use "Add section" to add something like Certifications, and the up/down buttons to reorder sections or entries.
2. **Switch to Source anytime.** It's the same underlying JSON, always in sync — useful for pasting in a resume you already have, or for fine control the form doesn't expose.
3. **Format text inline.** Select a bit of text in the preview (a summary line or a bullet) and a small toolbar appears — Bold, Italic, Reset.
4. **Customize the look.** Click **Customize** to adjust margin, spacing, line height, and font/size/color per section — or click **Auto-fit to page** to have it shrink automatically until your resume fits one page.
5. **Try a different template.** The dropdown next to Customize switches templates without touching your data.
6. **Import your own resume.** Click **Import Resume** and drop in a PDF, DOCX, or JSON file — it's parsed straight into the editor. PDF/DOCX parsing is best-effort, so double-check the result (the app will flag it for review).
7. **Export to PDF.** Click **Export to PDF** — it uses the browser's native print, so the result has real selectable text, not a flattened image.
8. **Download the JSON.** Click **Download JSON** to save your resume as a plain file you can keep in your own git repo, edit by hand, or bring back into the app later via Import.

Everything after step 1 autosaves to your browser's `localStorage` as you go — refreshing the page won't lose your work.

### Available scripts

| Command           | What it does                                      |
| ------------------ | -------------------------------------------------- |
| `npm run dev`       | Start the Vite dev server with hot reload           |
| `npm run build`     | Type-check and build the production bundle to `dist/` |
| `npm run preview`   | Serve the production build locally, for testing offline/PWA behavior |
| `npm run test`      | Run the Vitest unit test suite                      |
| `npm run test:e2e`  | Run the Playwright end-to-end suite (builds and serves the production bundle first) |

## Project structure

```
index.html               # App shell: topbar, editor tabs, preview, customize dialog
src/
  main.ts                # Wires everything together — the only file with DOM event logic
  types/resume.ts         # ResumeData shape: basics + an extensible sections[] array
  data/sample-resume.json # Default starter content
  lib/
    validate.ts            # Parses + validates resume JSON, migrates legacy field names/shapes
    storage.ts              # localStorage persistence, file download/read helpers
    stylePrefs.ts            # Style customization panel state (fonts, colors, spacing, margin)
    formEditor.ts             # Builds the dynamic Form view from the same ResumeData
    inlineMarkup.ts            # Converts between **bold**/_italic_ markup and preview HTML
    jsonPath.ts                # Writes an inline-formatted edit back into the resume JSON
    escapeHtml.ts               # HTML-escaping helper used by templates
    print.ts                    # Triggers window.print() for PDF export
    importers/
      pdf.ts                     # PDF text extraction (pdfjs-dist)
      pdfTextLayout.ts            # Pure text-layout reconstruction logic (line grouping, spacing)
      docx.ts                     # DOCX text extraction (mammoth)
      heuristics.ts                # Best-effort structuring of extracted text into ResumeData
  templates/
    index.ts                # Template registry
    shared/render.ts         # Generic renderer shared by every template
    minimal/                 # Single-column, ATS-safe template
    modern/                   # A second, visually distinct template
tests/                    # Vitest unit tests, mirroring src/lib
```

## How PDF/DOCX import works

Text is extracted entirely client-side, then a heuristic engine looks for section headers (Experience, Education, Skills, ...), date ranges, and common header conventions ("Company | Position", "Position, Company") to structure it into the app's JSON format. Headings it doesn't recognize (Certifications, Awards, ...) still become real sections rather than being dropped. This is intentionally approximate — real-world resumes vary too much in layout for a lightweight, offline, dependency-free parser to get perfect every time — so imported resumes are flagged for review. The line-numbered editor with inline error messages makes it fast to spot-check and fix anything the importer got wrong.

## Deployment

Pushing to `main` automatically builds and deploys to GitHub Pages via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) — it installs dependencies, runs the test suite, builds with the correct base path for GitHub Pages' subdirectory hosting, then force-pushes the built output to a `gh-pages` branch (GitHub Pages is configured to serve from that branch). `main` only ever holds source — the build output is never committed there. No manual build step required, and `gh-pages`'s history doubles as a rollback point for every previously deployed build.

`main` is protected: changes go through a pull request, and [`.github/workflows/ci.yml`](.github/workflows/ci.yml) must pass (tests + a full build) before it can be merged.

## License

No license file yet — all rights reserved by default until one is added.
