# Offline Resume Builder

A frontend-only, offline-first resume builder. Your resume lives as a single git-diff-friendly JSON file, renders live into an ATS-friendly template, and exports to PDF via the browser's native print — no server, no account, no analytics, nothing ever leaves your browser.

**Live demo:** https://luviein.github.io/resumebuilder/

## Why

Most resume builders are SaaS products that store your data on a server and export bloated, image-based PDFs that applicant tracking systems (ATS) can't parse. This is the opposite: a static site that works with zero network connection, keeps your resume as plain JSON you can track in git like code, and prints to a PDF with real, selectable, ATS-parseable text.

## Features

- **Offline-first / installable PWA** — after the first load, the app works with no network at all, and can be installed to your home screen or desktop.
- **Privacy-first** — no server, no analytics, no tracking. Your resume data only ever lives in your browser's `localStorage`.
- **Git-diff-friendly source of truth** — the resume is a single `resume.json` file, so edits show up as clean, readable diffs instead of opaque binary changes. Based on the [JSON Resume](https://jsonresume.org/schema/) schema (with clearer `companyName`/`positionName` fields on work entries instead of the standard's ambiguous `name`/`position`) — a plain JSON Resume file still loads correctly, since the legacy field names are recognized automatically.
- **ATS-friendly export** — "Export to PDF" uses the browser's native print, producing a PDF with real selectable text (not a rasterized screenshot), which is what makes it parseable by applicant tracking systems.
- **Import an existing resume** — upload a PDF, DOCX, or JSON file and it's parsed (heuristically, for PDF/DOCX) straight into the structured format, so you don't have to start from a blank file. Best-effort: PDF/DOCX imports are flagged for review since real-world resume layouts vary a lot.
- **Live JSON editor** — a line-numbered, syntax-aware textarea with inline validation errors (click an error to jump to the offending line) and a live-updating preview beside it.
- **Style customization** — control page margin, spacing, line-height, and font/size/color independently for the header, section headings, and body text, from a small floating panel. Settings persist locally and apply identically to the printed/exported PDF.
- **Mobile-friendly** — responsive layout with a tab-switched editor/preview view on narrow screens.

## Tech stack

- **[Vite](https://vitejs.dev/)** + **TypeScript**, no UI framework — the app is a JSON editor and a live-rendered preview, which doesn't need one.
- **[vite-plugin-pwa](https://vite-pwa-org.netlify.app/)** for the offline service worker and installable manifest.
- **[pdfjs-dist](https://mozilla.github.io/pdf.js/)** and **[mammoth](https://github.com/mwilliamson/mammoth.js)** for client-side PDF/DOCX text extraction (both lazy-loaded — they're not part of the base app bundle).
- **[Vitest](https://vitest.dev/)** for unit tests.

No backend, no external API calls, no analytics — anywhere.

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL (typically `http://localhost:5173`).

### Available scripts

| Command           | What it does                                      |
| ------------------ | -------------------------------------------------- |
| `npm run dev`       | Start the Vite dev server with hot reload           |
| `npm run build`     | Type-check and build the production bundle to `dist/` |
| `npm run preview`   | Serve the production build locally, for testing offline/PWA behavior |
| `npm run test`      | Run the Vitest test suite                           |

## Project structure

```
index.html               # App shell: topbar, editor, preview, customize dialog
src/
  main.ts                # Wires everything together — the only file with DOM event logic
  types/resume.ts         # ResumeData shape (JSON Resume-based, work entries use companyName/positionName)
  data/sample-resume.json # Default starter content
  lib/
    validate.ts            # Parses + validates resume JSON, normalizes legacy field names
    storage.ts              # localStorage persistence, file download/read helpers
    stylePrefs.ts            # Style customization panel state (fonts, colors, spacing, margin)
    escapeHtml.ts             # HTML-escaping helper used by templates
    print.ts                  # Triggers window.print() for PDF export
    importers/
      pdf.ts                   # PDF text extraction (pdfjs-dist)
      pdfTextLayout.ts          # Pure text-layout reconstruction logic (line grouping, spacing)
      docx.ts                   # DOCX text extraction (mammoth)
      heuristics.ts              # Best-effort structuring of extracted text into ResumeData
  templates/
    index.ts                # Template registry
    minimal/                # The one shipped template — single column, ATS-safe
tests/                    # Vitest unit tests, mirroring src/lib
```

## How PDF/DOCX import works

Text is extracted entirely client-side, then a heuristic engine looks for section headers (Experience, Education, Skills, ...), date ranges, and common header conventions ("Company | Position", "Position, Company") to structure it into the app's JSON format. This is intentionally approximate — real-world resumes vary too much in layout for a lightweight, offline, dependency-free parser to get perfect every time — so imported resumes are flagged for review. The line-numbered editor with inline error messages makes it fast to spot-check and fix anything the importer got wrong.

## Deployment

Pushing to `main` automatically builds and deploys to GitHub Pages via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) — it installs dependencies, runs the test suite, builds with the correct base path for GitHub Pages' subdirectory hosting, and deploys the result. No manual build step required.

## License

No license file yet — all rights reserved by default until one is added.
