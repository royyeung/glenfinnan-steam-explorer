"""Check which Scottish Remote Sensing Portal LiDAR layers have data at the viaduct.

Queries the portal's public WMS (GetMap, transparent PNG) and counts non-transparent
pixels. Also renders an overview map of current coverage around Glenfinnan.

Run (no host runtimes; throwaway container):
  docker run --rm -v "$PWD":/w -w /w python:3.12-slim \
    bash -c "pip -q install pillow && python tools/lidar_coverage_probe.py"

Data: Scottish Remote Sensing Portal WMS, Open Government Licence v3.0.
"""
import io
import urllib.request

from PIL import Image, ImageDraw

WMS = "https://ows.remotesensing.data.gov.scot/geoserver/ows"
VIADUCT = (56.876285, -5.431914)  # lat, lon (Wikipedia, Glenfinnan Viaduct)
LAYERS = [
    "scotland:dsm-footprint-aggregate",  # "Combined Data Presence"
    "scotland:lidar-aggregate",
    "scotland:scotland-lidar-1-dtm",
    "scotland:scotland-lidar-2-dtm",
    "scotland:nlp-dtm",  # Scottish Land LiDAR Programme (2025-2027)
    "scotland:coastal-2025-2026-dtm",
    "scotland:scotland-gov-lidar-hes-hes-2010s10-dtm",
    "scotland:scotland-gov-lidar-hes-hes-2017-dtm",
]


def get_map(layer, lat, lon, half_lat, size):
    half_lon = half_lat * 1.8  # roughly square on the ground at 57 N
    bbox = f"{lat - half_lat},{lon - half_lon},{lat + half_lat},{lon + half_lon}"
    url = (f"{WMS}?service=WMS&version=1.3.0&request=GetMap&layers={layer}&styles="
           f"&crs=EPSG:4326&bbox={bbox}&width={size}&height={size}"
           f"&format=image/png&transparent=true")
    with urllib.request.urlopen(url, timeout=180) as r:
        if not r.headers.get("Content-Type", "").startswith("image"):
            raise RuntimeError(r.read(300).decode(errors="replace"))
        return Image.open(io.BytesIO(r.read())).convert("RGBA")


def covered(img):
    return sum(1 for a in img.getchannel("A").get_flattened_data() if a > 0)


def main():
    lat, lon = VIADUCT
    # control: Glasgow is known to be covered by Phase 1
    print("control Glasgow phase-1:", covered(get_map("scotland:scotland-lidar-1-dtm", 55.86, -4.25, 0.05, 64)), "/4096")
    for layer in LAYERS:
        n = covered(get_map(layer, lat, lon, 0.05, 64))
        print(f"{layer}: {n}/4096 px with data within ~5.5 km of the viaduct")

    size, half = 600, 1.2
    out = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    for layer, col in [("scotland:dsm-footprint-aggregate", (120, 120, 120)),
                       ("scotland:nlp-dtm", (0, 120, 255)),
                       ("scotland:coastal-2025-2026-dtm", (0, 180, 0))]:
        img = get_map(layer, lat, lon, half, size)
        tint = Image.new("RGBA", (size, size), col + (255,))
        tint.putalpha(img.getchannel("A").point(lambda p: 120 if p > 0 else 0))
        out.alpha_composite(tint)
    draw = ImageDraw.Draw(out)
    half_lon = half * 1.8
    for name, la, lo in [("Glenfinnan", lat, lon), ("Fort William", 56.8198, -5.1052),
                         ("Mallaig", 57.0047, -5.8298), ("Oban", 56.415, -5.472)]:
        x = (lo - (lon - half_lon)) / (2 * half_lon) * size
        y = ((lat + half) - la) / (2 * half) * size
        draw.ellipse([x - 4, y - 4, x + 4, y + 4], outline=(255, 0, 0, 255), width=2)
        draw.text((x + 6, y - 6), name, fill=(200, 0, 0, 255))
    draw.text((5, 5), "grey=all published  blue=Land LiDAR Programme  green=coastal 2025-26", fill=(0, 0, 0, 255))
    out.save("lidar-coverage.png")
    print("wrote lidar-coverage.png")


if __name__ == "__main__":
    main()
