# Download CC0 maps listed in sources.json from the Poly Haven API and convert to PNG for encoding.
import json, os, urllib.request
from PIL import Image
UA = {"User-Agent": "GlenfinnanResearchBot/0.1 (https://github.com/royyeung/glenfinnan-steam-explorer)"}
src = json.load(open('tools/textures/sources.json'))
for key, s in src.items():
    if key.startswith('_'): continue
    files = json.load(urllib.request.urlopen(urllib.request.Request(f"https://api.polyhaven.com/files/{s['id']}", headers=UA)))
    out = f"data/cc0/{s['id']}"; os.makedirs(out, exist_ok=True)
    for m in s['maps']:
        info = files[m][s['res']]['jpg' if 'jpg' in files[m][s['res']] else 'png']
        raw = f"{out}/{m}.{info['url'].rsplit('.', 1)[1]}"
        if not os.path.exists(raw):
            open(raw, 'wb').write(urllib.request.urlopen(urllib.request.Request(info['url'], headers=UA)).read())
        Image.open(raw).convert('RGB').save(f"{out}/{m}.png")
        print(key, m, info['url'])
