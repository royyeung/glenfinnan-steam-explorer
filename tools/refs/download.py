import json, sys, time, urllib.request, os
UA = "GlenfinnanResearchBot/0.1 (https://github.com/royyeung/glenfinnan-steam-explorer; private educational research)"
d = json.load(open(sys.argv[1])); keys = sys.argv[3].split(','); outdir = sys.argv[2]
os.makedirs(outdir, exist_ok=True)
meta = []
for f in d['files']:
    if not any(k in f['title'] for k in keys): continue
    name = f['title'][5:].replace(' ', '_').replace('"', '').replace("'", '')
    path = os.path.join(outdir, name)
    if not os.path.exists(path):
        for a in range(6):
            try:
                time.sleep(1.5)
                req = urllib.request.Request(f['url'], headers={"User-Agent": UA})
                open(path, 'wb').write(urllib.request.urlopen(req, timeout=120).read()); break
            except Exception as e:
                print('retry', name, e); time.sleep(15 * (a + 1))
    meta.append(dict(file=name, **f))
    print('ok', name)
json.dump(meta, open(os.path.join(outdir, 'meta-' + os.path.basename(sys.argv[1])), 'w'), indent=1)
