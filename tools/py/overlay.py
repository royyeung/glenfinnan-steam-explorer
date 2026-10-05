"""Silhouette overlay: orthographic render (black on white) over the scaled reference photo.

Aligns one anchor point in both images (side views: front buffer face at rail level; front view:
midpoint between the buffer centres), scales the photo to the render's
pixels-per-metre, draws the render silhouette in red over a greyscale photo and measures the
render's outline at named stations so it can be compared with the photo-measured values.

python tools/py/overlay.py <silhouette.png> <photo.jpg> <out.jpg> <render_ax> <render_ay> <render_px_per_m> \
       <photo_ax> <photo_ay> <photo_px_per_m> [crop_x0 crop_y0 crop_x1 crop_y1] [--front]
"""
import json
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

Image.MAX_IMAGE_PIXELS = None
sil_p, photo_p, out_p = sys.argv[1:4]
rfx, rry, rppm, pfx, pry, pppm = map(float, sys.argv[4:10])
front_view = '--front' in sys.argv
nums = [a for a in sys.argv[10:] if a != '--front']
crop = list(map(int, nums[:4])) if len(nums) >= 4 else None

sil = Image.open(sil_p).convert('L')
W, H = sil.size
photo = Image.open(photo_p).convert('RGB')
if crop:
    photo = photo.crop(crop)
    pfx -= crop[0]
    pry -= crop[1]
s = rppm / pppm
photo = photo.resize((int(photo.width * s), int(photo.height * s)), Image.LANCZOS)
base = Image.new('RGB', (W, H), (255, 255, 255))
base.paste(photo, (int(round(rfx - pfx * s)), int(round(rry - pry * s))))
grey = ImageOps.grayscale(base).convert('RGB')
grey = Image.blend(grey, Image.new('RGB', (W, H), (255, 255, 255)), 0.25)

mask = np.array(sil) < 128
edge = Image.fromarray((mask * 255).astype('uint8')).filter(ImageFilter.FIND_EDGES)
red = Image.new('RGB', (W, H), (220, 30, 30))
out = Image.composite(Image.blend(grey, red, 0.35), grey, Image.fromarray((mask * 255).astype('uint8')))
out = Image.composite(red, out, edge.point(lambda v: 255 if v > 0 else 0))
d = ImageDraw.Draw(out)
d.line([(0, rry), (W, rry)], fill=(0, 120, 255), width=1)
d.line([(rfx, 0), (rfx, H)], fill=(0, 120, 255), width=1)
out.save(out_p, quality=90)


def top_height(d0, d1):
    """Highest silhouette point (m above rail) between d0 and d1 metres behind the front buffer."""
    x0, x1 = int(rfx - d1 * rppm), int(rfx - d0 * rppm)
    cols = mask[:, max(0, x0):max(0, x1)]
    rows = np.where(cols.any(axis=1))[0]
    return round((rry - rows.min()) / rppm, 3) if len(rows) else None


def front_face():
    cols = np.where(mask[: int(rry) - 5, :].any(axis=0))[0]
    return round((rfx - cols.max()) / rppm, 3) if len(cols) else None


if front_view:
    cols = np.where(mask.any(axis=0))[0]
    rows = np.where(mask.any(axis=1))[0]
    metrics = {'width_m': round((cols.max() - cols.min()) / rppm, 3), 'top_above_anchor_m': round((rry - rows.min()) / rppm, 3)}
    json.dump(metrics, open(out_p.rsplit('.', 1)[0] + '.json', 'w'), indent=1)
    print(json.dumps(metrics))
    sys.exit(0)

metrics = {
    'front_extreme_d': front_face(),
    'chimney_top_h': top_height(2.2, 2.8),
    'dome_top_h': top_height(6.4, 6.9),
    'cab_roof_h': top_height(10.3, 12.4),
    'tender_coal_sides_h': top_height(13.5, 17.0),
    'tender_rear_tank_h': top_height(18.2, 18.9),
}
json.dump(metrics, open(out_p.rsplit('.', 1)[0] + '.json', 'w'), indent=1)
print(json.dumps(metrics))
