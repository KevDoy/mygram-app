#!/bin/bash
# ============================================================
# process-photos.sh
#
# Scans photos/originals/ for new images not yet in the JSON
# manifest.  For each new photo it:
#   1. Extracts EXIF metadata (date, camera, lens, GPS, etc.)
#   2. Generates a web-optimized WebP (70% quality, max 2048px)
#   3. Generates 1:1 centre-cropped WebP thumbnails at 3 sizes
#      – 1080px (high-res grid / lightbox preview)
#      – 640px  (desktop grid)
#      – 360px  (mobile grid)
#   4. Prepends the photo entry to data/photos.json
#   5. Re-sorts the array newest-first by date
#   6. Generates sitemap.xml for SEO
#
# Requirements:
#   brew install exiftool imagemagick jq
#
# Usage:
#   ./scripts/process-photos.sh
#   ./scripts/process-photos.sh --caption "Sunset at the beach"
#   ./scripts/process-photos.sh -c "Sunset at the beach"
# ============================================================

set -euo pipefail

# ---- Parse arguments ----
CAPTION=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -c|--caption)
      CAPTION="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--caption \"text\"]"
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

ORIGINALS_DIR="$PROJECT_DIR/photos/originals"
THUMBS_DIR="$PROJECT_DIR/photos/thumbnails"
THUMBS_640_DIR="$PROJECT_DIR/photos/thumbnails/640"
THUMBS_360_DIR="$PROJECT_DIR/photos/thumbnails/360"
WEB_DIR="$PROJECT_DIR/photos/web"
JSON_FILE="$PROJECT_DIR/data/photos.json"
SITEMAP_FILE="$PROJECT_DIR/sitemap.xml"
THUMB_SIZE="1080x1080"
THUMB_640_SIZE="640x640"
THUMB_360_SIZE="360x360"
WEB_QUALITY="70"
THUMB_QUALITY="75"
WEB_MAX_DIMENSION="2048"

# Supported image extensions (lowercase checked)
SUPPORTED_EXTENSIONS="jpg|jpeg|png|tiff|tif|heic|heif|webp|avif|bmp"

# ---- Check dependencies ----
missing=()
command -v exiftool >/dev/null 2>&1 || missing+=("exiftool")
command -v jq       >/dev/null 2>&1 || missing+=("jq")
# Check for ImageMagick (magick v7 or convert v6)
if ! command -v magick >/dev/null 2>&1 && ! command -v convert >/dev/null 2>&1; then
  missing+=("imagemagick")
fi

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "❌  Missing dependencies: ${missing[*]}"
  echo "   Install with:  brew install ${missing[*]}"
  exit 1
fi

# Pick the right ImageMagick command
if command -v magick >/dev/null 2>&1; then
  MAGICK_CMD="magick"
else
  MAGICK_CMD="convert"
fi

# ---- Ensure directories exist ----
mkdir -p "$ORIGINALS_DIR" "$THUMBS_DIR" "$THUMBS_640_DIR" "$THUMBS_360_DIR" "$WEB_DIR"

# ---- Ensure JSON file exists ----
if [[ ! -f "$JSON_FILE" ]]; then
  echo '{"profile":{},"photos":[]}' | jq . > "$JSON_FILE"
fi

# ---- Collect already-known filenames ----
known_files=$(jq -r '.photos[].filename' "$JSON_FILE" 2>/dev/null || echo "")

new_count=0
skipped_count=0

for filepath in "$ORIGINALS_DIR"/*; do
  [[ ! -f "$filepath" ]] && continue

  filename="$(basename "$filepath")"

  # ---- Skip hidden files (e.g. .DS_Store, .gitkeep) ----
  [[ "$filename" == .* ]] && continue

  # ---- Sanitize filename: replace spaces & special chars with hyphens ----
  sanitized="$(echo "$filename" | sed 's/[[:space:]]/-/g' | sed 's/[^a-zA-Z0-9._-]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')"
  if [[ "$sanitized" != "$filename" ]]; then
    # Avoid collisions
    if [[ -f "$ORIGINALS_DIR/$sanitized" && "$ORIGINALS_DIR/$sanitized" != "$filepath" ]]; then
      base="${sanitized%.*}"
      ext_s="${sanitized##*.}"
      counter=1
      while [[ -f "$ORIGINALS_DIR/${base}-${counter}.${ext_s}" ]]; do
        counter=$((counter + 1))
      done
      sanitized="${base}-${counter}.${ext_s}"
    fi
    mv "$filepath" "$ORIGINALS_DIR/$sanitized"
    echo "   📝 Renamed: $filename → $sanitized"
    filepath="$ORIGINALS_DIR/$sanitized"
    filename="$sanitized"
  fi

  # ---- Check file extension is a supported image type ----
  ext="${filename##*.}"
  ext_lower=$(echo "$ext" | tr '[:upper:]' '[:lower:]')
  if ! echo "$ext_lower" | grep -qE "^($SUPPORTED_EXTENSIONS)$"; then
    echo "⏭  Skipping non-image file: $filename"
    skipped_count=$((skipped_count + 1))
    continue
  fi

  # ---- Skip if already tracked ----
  if echo "$known_files" | grep -qxF "$filename"; then
    continue
  fi

  echo "→ Processing: $filename"

  # ---- Extract EXIF via exiftool (JSON output) ----
  exif_json=$(exiftool -json -d "%Y-%m-%dT%H:%M:%S" \
    -DateTimeOriginal -CreateDate -ModifyDate \
    -Make -Model -LensModel \
    -FocalLength -FNumber -ExposureTime -ISO \
    -GPSLatitude -GPSLongitude -GPSPosition \
    -ImageWidth -ImageHeight \
    "$filepath" 2>/dev/null || echo "[{}]")

  # Parse individual fields (cascade through date fields)
  date=$(echo "$exif_json" | jq -r '.[0].DateTimeOriginal // .[0].CreateDate // .[0].ModifyDate // empty')
  make=$(echo "$exif_json"       | jq -r '.[0].Make // empty')
  model=$(echo "$exif_json"      | jq -r '.[0].Model // empty')
  lens=$(echo "$exif_json"       | jq -r '.[0].LensModel // empty')
  focal=$(echo "$exif_json"      | jq -r '.[0].FocalLength // empty')
  aperture=$(echo "$exif_json"   | jq -r '.[0].FNumber // empty')
  shutter=$(echo "$exif_json"    | jq -r '.[0].ExposureTime // empty')
  iso=$(echo "$exif_json"        | jq -r '.[0].ISO // empty')
  gps_lat=$(echo "$exif_json"    | jq -r '.[0].GPSLatitude // empty')
  gps_lon=$(echo "$exif_json"    | jq -r '.[0].GPSLongitude // empty')
  img_w=$(echo "$exif_json"      | jq -r '.[0].ImageWidth // empty')
  img_h=$(echo "$exif_json"      | jq -r '.[0].ImageHeight // empty')

  # ---- Fallback date: use file modification date if no EXIF date ----
  if [[ -z "$date" ]]; then
    date=$(stat -f "%Sm" -t "%Y-%m-%dT%H:%M:%S" "$filepath" 2>/dev/null || echo "")
    [[ -n "$date" ]] && echo "   ⚠ No EXIF date — using file modification date"
  fi

  # Build camera string (deduplicate make from model)
  camera=""
  if [[ -n "$make" && -n "$model" ]]; then
    # If model already contains the make, just use model
    if echo "$model" | grep -qi "$make"; then
      camera="$model"
    else
      camera="$make $model"
    fi
  elif [[ -n "$model" ]]; then
    camera="$model"
  fi

  # Build settings string  e.g. "35mm  f/1.8  1/250s  ISO 400"
  settings_parts=()
  [[ -n "$focal" ]]    && settings_parts+=("$focal")
  [[ -n "$aperture" ]] && settings_parts+=("f/$aperture")
  [[ -n "$shutter" ]]  && settings_parts+=("${shutter}s")
  [[ -n "$iso" ]]      && settings_parts+=("ISO $iso")
  settings=""
  if [[ ${#settings_parts[@]} -gt 0 ]]; then
    settings=$(IFS="  "; echo "${settings_parts[*]}")
  fi

  # ---- Reverse-geocode GPS to location name (optional) ----
  location=""
  if [[ -n "$gps_lat" && -n "$gps_lon" ]]; then
    location=$(curl -sf \
      -H "User-Agent: mygram-photo-site/1.0" \
      "https://nominatim.openstreetmap.org/reverse?lat=${gps_lat}&lon=${gps_lon}&format=json&zoom=10" \
      | jq -r '.display_name // empty' 2>/dev/null || echo "")
    # Trim to city-level (first 2 components)
    if [[ -n "$location" ]]; then
      location=$(echo "$location" | cut -d',' -f1-2 | sed 's/^ *//;s/ *$//')
    fi
    sleep 1  # be polite to Nominatim
  fi

  # ---- Generate web-optimized WebP (full res, capped at 2048px longest edge) ----
  web_filename="${filename%.*}.webp"
  $MAGICK_CMD "$filepath" -auto-orient \
    -resize "${WEB_MAX_DIMENSION}x${WEB_MAX_DIMENSION}>" \
    -quality "$WEB_QUALITY" \
    "$WEB_DIR/$web_filename"

  echo "   ✓ Web-optimized → $web_filename"

  # ---- Generate thumbnail (centre-crop to 1:1, also WebP) – 3 sizes ----
  thumb_filename="thumb_${filename%.*}.webp"

  # 1080px (high-res)
  $MAGICK_CMD "$filepath" -auto-orient \
    -thumbnail "${THUMB_SIZE}^" \
    -gravity center -extent "$THUMB_SIZE" \
    -quality "$THUMB_QUALITY" \
    "$THUMBS_DIR/$thumb_filename"

  # 640px (desktop grid)
  $MAGICK_CMD "$filepath" -auto-orient \
    -thumbnail "${THUMB_640_SIZE}^" \
    -gravity center -extent "$THUMB_640_SIZE" \
    -quality "$THUMB_QUALITY" \
    "$THUMBS_640_DIR/$thumb_filename"

  # 360px (mobile grid)
  $MAGICK_CMD "$filepath" -auto-orient \
    -thumbnail "${THUMB_360_SIZE}^" \
    -gravity center -extent "$THUMB_360_SIZE" \
    -quality "$THUMB_QUALITY" \
    "$THUMBS_360_DIR/$thumb_filename"

  echo "   ✓ Thumbnails → 1080 / 640 / 360"

  # ---- Use caption from CLI arg ----
  photo_caption="$CAPTION"

  # ---- Generate URL-safe slug from filename ----
  slug=$(echo "${filename%.*}" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')

  # ---- Build new JSON entry ----
  new_entry=$(jq -n \
    --arg fn "$filename" \
    --arg wf "$web_filename" \
    --arg th "$thumb_filename" \
    --arg sl "$slug" \
    --arg dt "$date" \
    --arg cap "$photo_caption" \
    --arg cam "$camera" \
    --arg ln "$lens" \
    --arg st "$settings" \
    --arg loc "$location" \
    --arg lat "$gps_lat" \
    --arg lon "$gps_lon" \
    --arg w "$img_w" \
    --arg h "$img_h" \
    '{
      filename: $fn,
      web: $wf,
      thumbnail: $th,
      slug: $sl,
      date: $dt,
      caption: $cap,
      camera: $cam,
      lens: $ln,
      settings: $st,
      location: $loc,
      gps: { lat: $lat, lon: $lon },
      width: ($w | if . != "" then tonumber else null end),
      height: ($h | if . != "" then tonumber else null end)
    }')

  # ---- Prepend to photos array ----
  tmp=$(mktemp)
  jq --argjson entry "$new_entry" '.photos = [$entry] + .photos' "$JSON_FILE" > "$tmp"
  mv "$tmp" "$JSON_FILE"

  new_count=$((new_count + 1))
  echo "   ✓ Added to photos.json"
done

# ---- Sort photos array newest-first by date ----
if [[ $new_count -gt 0 ]]; then
  tmp=$(mktemp)
  jq '.photos |= sort_by(.date) | .photos |= reverse' "$JSON_FILE" > "$tmp"
  mv "$tmp" "$JSON_FILE"
  echo ""
  echo "📅  Sorted photos newest-first by date."
fi

echo ""
if [[ $new_count -gt 0 ]]; then
  echo "✅  Processed $new_count new photo(s)."

  # ---- Generate sitemap.xml ----
  SITE_URL=$(jq -r '.profile.siteUrl // empty' "$JSON_FILE")
  if [[ -n "$SITE_URL" ]]; then
    {
      echo '<?xml version="1.0" encoding="UTF-8"?>'
      echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
      echo "  <url><loc>${SITE_URL}</loc></url>"
      jq -r --arg base "$SITE_URL" '.photos[].slug | "  <url><loc>\($base)#photo=\(.)</loc></url>"' "$JSON_FILE"
      echo '</urlset>'
    } > "$SITEMAP_FILE"
    echo "🗺  Generated sitemap.xml"
  fi
elif [[ $skipped_count -gt 0 ]]; then
  echo "ℹ️  No new photos found ($skipped_count non-image file(s) skipped)."
else
  echo "ℹ️  No new photos found."
fi