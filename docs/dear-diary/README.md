# Dear Diary.

A reusable, browser-based journal shell inspired by Poppie’s Navy Journal’s original-image / transcription / notes layout. Poppie’s content and viewer are unchanged.

Open `index.html` directly, or serve this directory using a static web server. For a stable storage location, use the same browser and URL each time. No build, dependencies, account, or external requests are required.

## Included

- Custom journal title, introduction, owner, cover photograph, and three color palettes.
- Blank starting journal with writing prompts; no family-specific sample content.
- Add, edit, delete, and reorder dated pages; photograph or scanned page, transcription, caption, notes, links, tags, and favorites.
- Side-by-side image and text reader with previous/next navigation; stacked layout on phones.
- Search text, notes, captions, tags, and links; filter by tag or favorites; sort by date.
- Browser storage with explicit save-failure reporting. JPEG/PNG/WebP uploads resize to a maximum dimension of 1600 pixels. Original images should be kept separately.
- JSON export and validated restore, including uploaded images. Restore and deletion require confirmation.
- Keyboard-accessible native dialogs, labeled controls, and responsive layouts.

## Storage boundaries

Data lives in localStorage on this browser, device, and origin. It is not encrypted or synchronized. Private browsing, clearing site data, changing the URL/origin, or browser storage limits can affect access. Export backups regularly. This shell is intended for a modest personal collection; a larger production version should use IndexedDB or a dedicated storage service. The app does not publish user entries.

## Recommended additions

These are product ideas, not implemented capabilities or market-research findings:

1. **Encrypted backup and optional device sync.** Protect private writing and let people move between phone and computer. Define recovery and key ownership before implementation.
2. **Voice memories.** Record a story with an optional editable transcript; especially useful for family interviews.
3. **Scan and transcribe.** Crop/rotate handwritten pages, preserve originals, and offer opt-in OCR with side-by-side correction.
4. **A beautiful take-home book.** Print/PDF layouts with covers, captions, page numbers, and a table of contents.
5. **Purpose-built starter journals.** Family history, travel, gratitude, recipes, baby books, and daily reflections; each template stays editable.
6. **Invitation-only collaboration.** Let relatives contribute photos or stories to selected collections, with approval before inclusion and clear permissions.
7. **Timeline and places.** Browse entries chronologically or on an optional map without requiring location tracking.
8. **Gentle reminders and “on this day.”** Opt-in writing nudges and memory resurfacing; users choose frequency and can turn them off.

Suggested order: reliable storage and encrypted backups first, then printable books and starter templates; add voice, transcription, and collaboration after those foundations.

## Verification

Run `npm ci --prefix docs/dear-diary` and `npm test --prefix docs/dear-diary` from the repository root. The DOM integration tests exercise entry creation/editing, reload, search, tags/favorites, ordering, date sort, navigation, deletion confirmation, restoration, invalid links/backups, escaping, and storage failure. These tests do not render pixels or verify actual image decoding. Browser acceptance should cover creating/editing/reloading, uploads, search and filters, ordering, backup/restore, rejected unsafe links and invalid backups, and desktop/mobile layout.

Current validation: DOM integration tests and JavaScript syntax checks pass. Live browser preview was unavailable because local browser use is disabled in Work settings; desktop/mobile visual QA and actual photo upload remain unverified.

## Favicon artwork

Generated with the built-in imagegen tool. Original: `icons/diary-original.png`. Browser icon: `favicon.ico` with 16/32/48 pixel variants; PNGs in `icons/` include 16, 32, 48, 192 and 512 pixels plus a 180 pixel Apple touch icon. The 192 pixel version also appears in the header.

Prompt: a centered vintage chestnut leather diary with worn edges, gold embossed border and exact gold serif word “Diary,” plus an antique brass latch with a bold keyhole, nearly front-facing with slight spine depth, transparent background, strong silhouette for favicon use, and no extra objects or text.
