import json, sys
sys.path.insert(0, '.')
from commons import q, info  # noqa: E402
out = {}
for term in sys.argv[2:]:
    r = q(action="query", list="search", srsearch=term, srnamespace=6, srlimit=25)
    titles = [x["title"] for x in r["query"]["search"]]
    out[term] = info(titles) if titles else []
    print("==", term)
    for f in out[term]:
        print(f"  {(f['date'] or '?')[:22]} | {f['w']}x{f['h']} | {f['lic'][:12]} | {f['title'][5:85]} | {f['desc'][:70]}")
json.dump(out, open(sys.argv[1], "w"), indent=1)
