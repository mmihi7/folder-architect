#!/bin/bash
set -e

echo "============================================"
echo "  Folder Architect - Build Script"
echo "============================================"
echo ""

# Check dependencies
echo "[1/5] Checking dependencies..."
command -v python3 >/dev/null 2>&1 || { echo "ERROR: python3 is required"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "ERROR: node is required"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "ERROR: npm is required"; exit 1; }
echo "  ✓ All dependencies present"

# Create build dir and icon if missing
echo "[2/5] Preparing build assets..."
mkdir -p build
if [ ! -f build/icon.png ]; then
  echo "  Creating default icon..."
  python3 -c "
from PIL import Image, ImageDraw, ImageFont
import os
img = Image.new('RGBA', (512, 512), (30, 30, 46, 255))
d = ImageDraw.Draw(img)
d.rounded_rectangle([100, 140, 412, 400], radius=20, fill=(124, 58, 237, 255))
d.polygon([(100, 140), (100, 200), (220, 200), (240, 160), (240, 140)], fill=(109, 40, 217, 255))
for i, y in enumerate([230, 270, 310, 350]):
    d.rounded_rectangle([140, y, 372, y+20], radius=4, fill=(224, 224, 239, 60 + i*30))
img.save('build/icon.png')
print('  ✓ Created build/icon.png')
" 2>/dev/null || {
    echo "  ! PIL not available, creating minimal placeholder icon"
    python3 -c "
import struct, zlib
def png_chunk(typ, data):
    chunk = typ + data
    return struct.pack('>I', len(data)) + chunk + struct.pack('>I', zlib.crc32(chunk) & 0xffffffff)
w, h = 512, 512
raw = b''
for _ in range(h):
    raw += b'\x00'
    raw += bytes([124, 58, 237, 255] * w)
png = b'\x89PNG\r\n\x1a\n'
png += png_chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
png += png_chunk(b'IDAT', zlib.compress(raw))
png += png_chunk(b'IEND', b'')
with open('build/icon.png', 'wb') as f:
    f.write(png)
print('  ✓ Created placeholder icon')
"
  }
fi

# Install PyInstaller
echo "[3/5] Setting up Python build tool..."
pip3 install --user --quiet pyinstaller 2>/dev/null || pip3 install --quiet pyinstaller 2>/dev/null || true
PYINSTALLER=$(python3 -c "import PyInstaller; import os; print(os.path.join(os.path.dirname(PyInstaller.__file__), '../bin/pyinstaller'))" 2>/dev/null || echo "pyinstaller")
echo "  ✓ PyInstaller ready"

# Build Python backend
echo "[4/5] Building Python backend..."
cd backend
 $PYINSTALLER --onefile --name folder-architect-backend scan.py --distpath dist --workpath build --specpath build 2>&1 | tail -3
cd ..
if [ ! -f backend/dist/folder-architect-backend ]; then
  echo "ERROR: Python backend build failed"
  exit 1
fi
echo "  ✓ Backend built: backend/dist/folder-architect-backend"

# Install Node deps and build
echo "[5/5] Building Electron app..."
npm install --silent
npm run dist:linux

echo ""
echo "============================================"
echo "  BUILD COMPLETE!"
echo "============================================"
echo ""
echo "Output files in release/:"
ls -la release/*.deb release/*.AppImage 2>/dev/null || ls -la release/ 2>/dev/null
echo ""
echo "To install on Linux Mint:"
echo "  sudo dpkg -i release/folder-architect_*.deb"
echo ""
echo "Or run the AppImage directly:"
echo "  chmod +x release/Folder\\ Architect-*.AppImage"
echo "  ./release/Folder\\ Architect-*.AppImage"
echo ""
