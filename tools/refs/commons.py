import json, sys, urllib.request, urllib.parse, re, html
UA = "GlenfinnanResearchBot/0.1 (https://github.com/royyeung/glenfinnan-steam-explorer; private educational research)"
API = "https://commons.wikimedia.org/w/api.php"
def q(**p):
    p.update(format="json")
    import time
    for attempt in range(8):
        time.sleep(1.0)
        req = urllib.request.Request(API + "?" + urllib.parse.urlencode(p), headers={"User-Agent": UA})
        try:
            return json.load(urllib.request.urlopen(req, timeout=60))
        except urllib.error.HTTPError as e:
            if e.code != 429: raise
            time.sleep(10 * (attempt + 1))
    raise RuntimeError("rate limited")
def members(cat, kind):
    out, cont = [], {}
    while True:
        r = q(action="query", list="categorymembers", cmtitle=cat, cmtype=kind, cmlimit=500, **cont)
        out += [m["title"] for m in r["query"]["categorymembers"]]
        if "continue" not in r: return out
        cont = {"cmcontinue": r["continue"]["cmcontinue"]}
def walk(root, depth):
    seen, files, todo = set(), set(), [(root, 0)]
    while todo:
        c, d = todo.pop()
        if c in seen: continue
        seen.add(c)
        files.update(members(c, "file"))
        if d < depth:
            todo += [(s, d + 1) for s in members(c, "subcat")]
    return sorted(files), sorted(seen)
def info(titles):
    res = []
    for i in range(0, len(titles), 40):
        r = q(action="query", prop="imageinfo", titles="|".join(titles[i:i+40]), iiprop="url|size|extmetadata", iiurlwidth=1600)
        for p in r["query"]["pages"].values():
            ii = p.get("imageinfo", [{}])[0]; m = ii.get("extmetadata", {})
            g = lambda k: re.sub(r"<[^>]+>", "", html.unescape(m.get(k, {}).get("value", "")))[:160]
            res.append(dict(title=p["title"], w=ii.get("width"), h=ii.get("height"), url=ii.get("url"), thumb=ii.get("thumburl"),
                            page=ii.get("descriptionurl"), date=g("DateTimeOriginal") or g("DateTime"), lic=g("LicenseShortName"),
                            artist=g("Artist"), desc=g("ImageDescription")))
    return res
if __name__ == "__main__":
    root, depth, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
    files, cats = walk(root, depth)
    data = info(files)
    json.dump(dict(cats=cats, files=data), open(out, "w"), indent=1)
    print(len(cats), "cats", len(data), "files")
