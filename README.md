# Internship Atlas

A static browser app for exploring live internship listing feeds, beginning with the
SimplifyJobs `Summer2026-Internships` JSON file.

## Run Locally

Serve this folder with any simple static server so live fetches and resume file parsing
work consistently:

```powershell
npx --yes serve . -l 4173
```

Then open `http://localhost:4173`.

## Included Features

- Live refresh from the public GitHub `listings.json` file, plus optional auto-refresh
  while the page remains open.
- Search, season/term, category, sponsorship, degree, location, active-status, source,
  and posted-date filters.
- A default `2026-01-01` posted-date cutoff so earlier records are not shown unless the
  user deliberately clears or changes that date.
- Direct `Apply` links for each listing and a paginated, sortable table.
- Browser-local refresh history that records new, changed, and removed relevant jobs.
- Additional compatible JSON feeds can be attached from the feed manager. GitHub
  `blob` URLs are converted to raw JSON URLs automatically.
- Resume matching from pasted text or PDF, DOCX, TXT, and MD uploads. The resume is
  processed locally and is not transmitted by this application.

## Matching Limitation

The source feed includes role metadata, but not complete job descriptions or required
skills. Resume match scores therefore indicate overlap with role categories and title
keywords; they are a shortlist aid rather than an eligibility decision.

## Files

- `index.html`: interface markup and third-party in-browser document readers.
- `styles.css`: responsive dashboard styling.
- `app.js`: fetch, normalization, filters, matching, local update history, and feed
  management.
