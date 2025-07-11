@echo off
echo Creating Windows ICO file from SVG...
echo.

REM Check if ImageMagick is available
magick -version >nul 2>&1
if %errorLevel% equ 0 (
    echo ImageMagick found! Creating ICO file...
    
    REM Create different sizes
    magick public/icon.svg -resize 256x256 public/icon-256.png
    magick public/icon.svg -resize 48x48 public/icon-48.png
    magick public/icon.svg -resize 32x32 public/icon-32.png
    magick public/icon.svg -resize 16x16 public/icon-16.png
    
    REM Combine into ICO
    magick public/icon-16.png public/icon-32.png public/icon-48.png public/icon-256.png public/app-icon.ico
    
    REM Clean up temporary files
    del public\icon-16.png public\icon-32.png public\icon-48.png public\icon-256.png
    
    echo ICO file created successfully: public/app-icon.ico
    echo.
    echo Now update package.json to use the new icon:
    echo "icon": "public/app-icon.ico"
    
) else (
    echo ImageMagick not found.
    echo.
    echo Please install ImageMagick or use one of these alternatives:
    echo 1. Go to https://convertico.com/
    echo 2. Upload public/icon.svg
    echo 3. Convert to ICO with sizes: 16, 32, 48, 256
    echo 4. Save as public/app-icon.ico
    echo.
    echo Or install ImageMagick from: https://imagemagick.org/script/download.php#windows
)

pause
