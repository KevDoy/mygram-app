# mygram

A static, Instagram-style photo portfolio website. Drop photos into a folder, run a script, and your site updates automatically. No server, no database, no build tools — just HTML, CSS, and vanilla JS.

## Features

- **Grid view** — 3-column, 1:1 cropped photo grid (like Instagram profile)
- **Timeline view** — Vertical card feed grouped by month
- **Lightbox** — Full-screen viewer with swipe gestures, keyboard nav, and photo metadata
- **Deep-linking** — Every photo has a shareable URL (`#photo=slug`)
- **Dark mode** — Automatic via `prefers-color-scheme`
- **Responsive images** — 3 thumbnail sizes (360 / 640 / 1080px) with `srcset`
- **Lazy loading** — IntersectionObserver with shimmer placeholders
- **PWA** — Installable on iOS and Android home screens
- **SEO** — Open Graph, Twitter Card meta tags, sitemap generation
- **Zero dependencies** — No npm, no frameworks, just Bootstrap 5 from CDN

## Quick Start

```bash
# 1. Install dependencies (macOS)
brew install exiftool imagemagick jq

# 2. Clone and enter the project
git clone https://github.com/YOUR_USERNAME/mygram.git
cd mygram

# 3. Customise your profile
#    Edit data/photos.json — update username, fullName, bio, bioLink
#    Replace assets/profile.jpg with your photo
#    Replace assets/icon.png with your app icon (square PNG, 512px+)

# 4. Add photos
cp ~/Photos/*.jpg photos/originals/

# 5. Process photos (extracts EXIF, generates WebP + thumbnails, updates JSON)
chmod +x scripts/process-photos.sh
./scripts/process-photos.sh

# Or with a caption:
./scripts/process-photos.sh --caption "Golden hour in Tokyo"

# 6. Serve locally
python3 -m http.server 8000
# Open http://localhost:8000
```

## Project Structure

```
mygram/
├── index.html                  ← Single-page app
├── manifest.json               ← PWA web app manifest
├── css/
│   └── style.css               ← All styles (light + dark mode)
├── js/
│   ├── app.js                  ← Entry point, loads JSON, populates profile
│   ├── grid.js                 ← 3-column photo grid with srcset
│   ├── timeline.js             ← Feed view with month grouping
│   ├── lightbox.js             ← Full-screen viewer, deep-linking, swipe
│   └── lazyload.js             ← IntersectionObserver lazy loading
├── data/
│   └── photos.json             ← Photo manifest + profile config
├── photos/
│   ├── originals/              ← Drop full-res photos here
│   ├── web/                    ← Auto-generated WebP (70% quality, max 2048px)
│   └── thumbnails/             ← Auto-generated 1:1 WebP crops
│       ├── *.webp              ← 1080px (high-res)
│       ├── 640/                ← 640px (desktop grid)
│       └── 360/                ← 360px (mobile grid)
├── assets/
│   ├── profile.jpg             ← Your profile picture
│   ├── icon.png                ← App icon source (2048×2048)
│   ├── icon-192.png            ← PWA icon
│   ├── icon-512.png            ← PWA icon
│   ├── apple-touch-icon.png    ← iOS home screen icon
│   ├── favicon-32.png          ← Browser tab icon
│   └── favicon-16.png          ← Browser tab icon
└── scripts/
    └── process-photos.sh       ← macOS photo processing script
```

## Configuration

Edit `data/photos.json` to set your profile:

```json
{
  "profile": {
    "username": "yourname",
    "fullName": "Your Name",
    "bio": "Photographer · Traveller",
    "bioLink": "https://yourwebsite.com",
    "profilePhoto": "assets/profile.jpg",
    "siteUrl": "https://yourname.github.io/mygram/"
  }
}
```

Setting `siteUrl` enables sitemap generation when you run the processing script.

## Processing Script

The script scans `photos/originals/` for new images and for each one:

1. Extracts EXIF metadata (date, camera, lens, GPS, exposure)
2. Reverse-geocodes GPS coordinates to a location name
3. Converts to web-optimized WebP (70% quality, max 2048px)
4. Generates 1:1 centre-cropped thumbnails at 1080px, 640px, and 360px
5. Adds the entry to `photos.json` (sorted newest-first)
6. Generates `sitemap.xml` (when `siteUrl` is configured)

Supported formats: JPG, PNG, TIFF, HEIC, WebP, AVIF, BMP.

```bash
# Process all new photos
./scripts/process-photos.sh

# Process with a caption
./scripts/process-photos.sh --caption "Sunset at the pier"
```

Re-running the script is safe — it skips photos already in the manifest.

## Deployment

The site is fully static. Deploy anywhere:

- **GitHub Pages** — Push to `main`, enable Pages in repo settings
- **Netlify / Vercel** — Connect the repo, no build command needed
- **Any web server** — Just copy all files

> **Note:** Processed photos (in `photos/web/` and `photos/thumbnails/`) must be committed and pushed for the site to work when deployed.

## License

MIT
