# Icon Generation Instructions

## Option 1: Online Conversion (Easiest)

1. Open `public/icon.svg` in any web browser
2. Take a screenshot or save as PNG at 256x256 pixels
3. Go to https://convertico.com/ or https://icoconvert.com/
4. Upload the PNG and convert to ICO with multiple sizes (16, 32, 48, 256)
5. Save as `public/app-icon.ico`

## Option 2: Using ImageMagick (if installed)

```bash
# Install ImageMagick first if not installed
# Then run:
magick public/icon.svg -resize 256x256 public/icon-256.png
magick public/icon.svg -resize 48x48 public/icon-48.png
magick public/icon.svg -resize 32x32 public/icon-32.png
magick public/icon.svg -resize 16x16 public/icon-16.png

# Combine into ICO
magick public/icon-16.png public/icon-32.png public/icon-48.png public/icon-256.png public/app-icon.ico
```

## Option 3: Using GIMP (Free)

1. Open GIMP
2. File > Open > Select `public/icon.svg`
3. Set import size to 256x256 pixels
4. File > Export As > Save as `app-icon.ico`
5. In ICO export dialog, add multiple sizes: 16, 32, 48, 256

## Option 4: Using Inkscape (Free)

1. Open `public/icon.svg` in Inkscape
2. File > Export PNG Image
3. Set width/height to 256
4. Export as PNG
5. Use online converter to create ICO with multiple sizes

## Current Icons in Project:

- `logo-clean.svg` - Main logo (256x256) - less busy, more readable
- `icon.svg` - App icon optimized for Windows
- `logo-small-clean.svg` - Small version (64x64)
- `favicon.ico` - Current favicon (32x32) - needs replacement

## After Creating app-icon.ico:

Replace the icon reference in `package.json`:
```json
"win": {
  "icon": "public/app-icon.ico"
}
```
