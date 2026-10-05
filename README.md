# Glenfinnan steam explorer

Private, unofficial, educational WebGL recreation of LMS Black Five 45407 "The Lancashire Fusilier", its tender and Mk2 coaches on the Glenfinnan Viaduct. It is not affiliated with West Coast Railways, Riley & Son, Network Rail or the locomotive's owners.

- `PLAN.md`: how it is built and verified, with the phases and their gates
- `REFERENCE.md`: verified specifications with sources and confidence levels, plus open questions and the reference photo list
- `CREDITS.md`: every external source, asset and library, with its licence

Private inputs go in `reference/` (photos plus `captions.md`; see `docs/captions-template.md`) and `data/` (raw terrain downloads). Both are git-ignored and never deployed.

Status: Phase 1 (foundations) done: live at https://royyeung.dev/glenfinnan/ (noindex; bots get 403).

## Working on it

All tools run in throwaway Docker containers; nothing is installed on the host.

```
tools/npm.sh ci                          # install dependencies
tools/npm.sh run build                   # typecheck + production build into dist/
tools/npm.sh exec -- vitest run          # unit tests (kinematics, solar position, specs)
tools/node.sh tools/assets/build.mjs     # regenerate compressed GLB models from src/loco
tools/textures/build.sh                  # fetch CC0 textures and encode KTX2 (needs the glenfinnan-ktx image)
tools/run.sh --install                   # once: harness dependencies (Playwright 1.49.1 image)
tools/run.sh shoot.mjs p1 --q=high       # fixed-view screenshots into shots/p1
tools/run.sh checks.mjs p1 all           # kinematics, human scale, audio, perf
rsync -a --delete dist/ /srv/www/glenfinnan/   # deploy
```

URL options: `?q=high|medium|low`, `?perf=1` (frame time and GPU name on your device), `?tune=1` or the backtick key (tuning panel with JSON export), `?debug=1` (exposes `window.GX`), `?fixed=1` (deterministic, renders on demand), `?live=1` (generate models in the browser instead of loading GLB).
