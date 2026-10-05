"""Contact sheet of every PNG in a shots folder (labelled thumbnails).

docker run --rm -v "$PWD":/w -w /w python:3.12-slim sh -c "pip -q install pillow && python tools/py/contact.py shots/p1 [pattern]"
"""
import glob
import os
import sys

from PIL import Image, ImageDraw

folder = sys.argv[1]
pattern = sys.argv[2] if len(sys.argv) > 2 else '*.png'
out_name = sys.argv[3] if len(sys.argv) > 3 else 'contact.jpg'
files = sorted(f for f in glob.glob(os.path.join(folder, pattern)) if not os.path.basename(f).startswith('contact'))
W, H, cols, pad, lab = 420, 236, 3, 8, 18
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (W + pad) + pad, rows * (H + lab + pad) + pad), (24, 24, 24))
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB')
    im.thumbnail((W, H))
    x = pad + (i % cols) * (W + pad)
    y = pad + (i // cols) * (H + lab + pad)
    sheet.paste(im, (x + (W - im.width) // 2, y + lab + (H - im.height) // 2))
    d.text((x, y + 2), os.path.basename(f)[:-4], fill=(235, 220, 170))
sheet.save(os.path.join(folder, out_name), quality=88)
print(len(files), 'images ->', os.path.join(folder, out_name))
