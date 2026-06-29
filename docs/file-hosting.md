# File hosting — how Download buttons get their files

The site is static; the actual files (PDFs, decks) live in Google Drive. There are
**two ways** a resource's Download button gets wired up. You can mix them.

## Option 1 — name-by-id (recommended; matches the in-sheet convention)

This is the workflow the Column Guide already describes: an editor sets
`link_type = download`, leaves `link_url` blank, and drops the file into the
published-files Drive folder **named starting with the resource id**, e.g.

```
cp-2-enabling-conditions-guide-and-self-assessment  Enabling Conditions Guide.pdf
```

A small Apps Script (`docs/apps-script/PublishFiles.gs`) indexes that folder and
writes a **`Files` tab** mapping `id -> url`. The website build reads that tab and
resolves every download automatically. Editors never touch a URL.

**Build behavior:** for a `download` resource with no `link_url`, the build looks up
its id in the `Files` tab. If found, the Download button opens that file. Once a
`Files` tab exists, any *published* resource that resolves to nothing is reported as
a build warning, so missing files can't hide.

### Set up the Apps Script (one time)
1. In the Sheet: **Extensions → Apps Script**, paste `PublishFiles.gs`, save.
2. Set `PUBLISHED_FOLDER_ID` to your published folder's Drive id (the part after
   `/folders/` in its URL).
3. Reload the Sheet → run **R2I → Rebuild Files manifest** and authorize.
4. Optional: add a daily time-driven trigger on `rebuildFilesManifest` so it stays
   fresh. (The site rebuilds nightly; a daily manifest refresh keeps pace.)

The script also sets each file to **Anyone with the link → Viewer** so the public
site can serve it, and reports any file whose name doesn't start with a known id.

## Option 2 — paste a link (for Docs, dashboards, anything already on the web)

Set `link_type = external_link` and put the full URL in `link_url` (a Google Doc, a
dashboard, a Drive share link — the build cleans Drive links up automatically). This
always wins over the manifest, so you can override a single resource any time.

## Videos and images

- **Video:** `link_type = embed`, put the Vimeo/YouTube/Drive link in `video_url`.
- **Images:** a Drive image link or URL in `image` / `header_image` / `hero_image`,
  or a bare filename served from the repo `assets/` folder. (Images can be added to
  the `Files`/media indexing later the same way downloads are — not wired yet.)

## The `Files` tab columns

| column | meaning |
| --- | --- |
| `id` | the resource id this file belongs to |
| `url` | the public file URL (the build opens this) |
| `mime` | the file's MIME type (informational) |
| `filename` | the original filename (informational) |

The build treats the `Files` tab as **optional**: no tab → downloads simply don't
resolve yet (handy before the script is installed). It's never hand-edited — the
Apps Script owns it.
