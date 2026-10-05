# Reference fetch tools

These scripts rebuild the private `reference/web/` folder (git-ignored) from Wikimedia Commons. The images are openly licensed (CC BY / CC BY-SA / CC0), and the full list with authors and licences is in `docs/reference-sources.md`. All scripts run in a throwaway `python:3.12-slim` container and are polite to the API (1 request/s, backs off on HTTP 429).

```
# list a category tree (depth 2-3) with dates and licences
docker run --rm -v "$PWD":/w -w /w python:3.12-slim python tools/refs/commons.py "Category:LMS Stanier Class 5 4-6-0 5407" 3 /tmp/c5407.json
# download the files whose titles contain any of the comma-separated fragments
docker run --rm -v "$PWD":/w -w /w python:3.12-slim python tools/refs/download.py /tmp/c5407.json reference/web/45407 "55068802046,8035578"
# regenerate reference/captions.md (expects reference/ mounted at /ref)
docker run --rm -v "$PWD":/w -v "$PWD/reference":/ref -w /w python:3.12-slim python tools/refs/captions.py
```
