"""Reference photo above, render below, aligned on one anchor point at the same pixels-per-metre.

python tools/py/compare.py <render.png> <photo.jpg> <out.jpg> <render_ax> <render_ay> <render_ppm> <photo_ax> <photo_ay> <photo_ppm> <label>
"""
import sys

from PIL import Image, ImageDraw

Image.MAX_IMAGE_PIXELS = None
r_p, p_p, out_p = sys.argv[1:4]
rax, ray, rppm, pax, pay, pppm = map(float, sys.argv[4:10])
label = sys.argv[10] if len(sys.argv) > 10 else ''
render = Image.open(r_p).convert('RGB')
W, H = render.size
photo = Image.open(p_p).convert('RGB')
s = rppm / pppm
# crop the photo region that maps onto the render frame, then scale it
x0, y0 = pax - rax / s, pay - ray / s
crop = photo.crop((int(x0), int(y0), int(x0 + W / s), int(y0 + H / s))).resize((W, H), Image.LANCZOS)
out = Image.new('RGB', (W, 2 * H + 30), (20, 20, 20))
out.paste(crop, (0, 0)); out.paste(render, (0, H + 30))
d = ImageDraw.Draw(out)
d.text((8, H + 8), f'above: reference photo   below: Phase 1 render   {label}', fill=(240, 220, 160))
out.save(out_p, quality=90)
print(out_p)
