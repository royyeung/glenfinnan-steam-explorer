import json, glob, os, re
R = '/ref'
groups = {'45407': 'Locomotive 45407', 'jacobite': 'The Jacobite train, 2024-2025', 'coach-cab': 'Mk2 coaches (West Coast Railways) and Black Five cab'}
# map file-name fragments to REFERENCE.md photo IDs
ids = [('55068802046', 'L01 (RIGHT side broadside, Oct 2025, emblem, nameplate)'), ('8035578', 'L04/L15 (front 3/4 right, Apr 2025)'),
       ('8039158', 'L04 (front 3/4 right, Apr 2025)'), ('8039169', 'L05 (front end, Apr 2025)'), ('8034822', 'L05/L21 (front, running, Apr 2025)'),
       ('Glenfinnan_Viaduct_-_Jacobite_Express', 'L21/V01 (45407 on the viaduct with headboard, Oct 2025)'),
       ('Caledonian_Canal', 'L06 (tender rear with headboard, tender-first, Sep 2025)'), ('53302898046', 'L06/L16 (rear 3/4, York 2023)'),
       ('53303268459', 'L05 (head-on, York 2023)'), ('29995070996', 'L08 (boiler top: dome and top feed, 2016)'),
       ('Black_5_Cab', 'C01 (backhead of a Black Five; NOT 45407)'), ('footplate', 'C02/C03 (44871 footplate)'), ('One_lump', 'C09/C11 (firing, a Black Five)'),
       ('5249', 'T01 (WCR maroon Mk2 TSO 5249, 2017)'), ('5236', 'T01 (WCR maroon Mk2 SO 5236, 2016)'), ('9104', 'T01 (WCR Mk2 BSO 9104)'),
       ('13440', 'T01 (WCR Mk2a FK 13440)'), ('M5125_(6776934181)', 'T01 (WCR maroon Mk2 TSO M5125, 2009)'),
       ('M5125_(7169852174)', 'T07/T09 (WCR maroon Mk2 TSO M5125 interior, 2012)'), ('Interior_of_Mk2_TSO', 'T07 (Mk2 TSO interior, Mid-Norfolk)'),
       ('M5175', 'T07 (Mk2 TSO M5175 interior, diagram 88)'), ('S5216', 'T01 (WCR Mk2 TSO S5216, 2008, green)')]
out = ['# captions.md (private comparison references)', '',
       'Generated from Wikimedia Commons metadata. Every file is openly licensed (CC BY / CC BY-SA / CC0); see each entry.',
       'These images are for side-by-side comparison only: never committed, deployed or traced.', '']
for sub, title in groups.items():
    metas = glob.glob(f'{R}/web/{sub}/meta-*.json')
    if not metas: continue
    out += [f'## {title}', '']
    seen = set()
    for m in metas:
        for f in json.load(open(m)):
            if f['file'] in seen: continue
            seen.add(f['file'])
            ref = next((v for k, v in ids if k in f['file']), '')
            out += [f"### web/{sub}/{f['file']}",
                    f"- Reference ID: {ref or '(general)'}",
                    f"- Date taken: {f['date'] or 'unknown'}",
                    f"- Author: {f['artist'] or 'unknown'}",
                    f"- Licence: {f['lic']}",
                    f"- Source: {f['page']}",
                    f"- Size: {f['w']}x{f['h']}",
                    f"- Description: {re.sub(r'\\s+', ' ', f['desc'])}", '']
open(f'{R}/captions.md', 'w').write('\n'.join(out))
print(len(out), 'lines')
