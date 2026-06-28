# assets/

Static files (images, etc.) committed to the repo. The build copies this whole
folder into `dist/assets/` so they're served by Netlify.

## Two ways to add an image or file

1. **Google Drive link (preferred for the content team).** Paste a Drive share
   link into the sheet's `link_url` / `video_url` / `image` / `header_image` /
   `hero_image` field. Nothing goes in this folder. See `docs/editor-guide.md`.

2. **Committed file (for developers / stable brand assets).** Drop the file here
   and reference it in the sheet by **bare filename** — e.g. put
   `hero-home.jpg` in this folder and set `hero_image` to `hero-home.jpg`. The
   build rewrites a bare filename to `assets/<filename>`.

## Notes

- Keep filenames lowercase, no spaces (use hyphens).
- For social/share previews (`og:image`), use a real `.jpg`/`.png` ~1200×630;
  SVGs don't reliably unfurl on social platforms.
- This README is harmless to ship; it just documents the folder.
