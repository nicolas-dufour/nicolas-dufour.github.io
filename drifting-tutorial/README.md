# Drifting Models — visual tutorial

A 46-slide Reveal.js tutorial: a visual introduction to [Generative Modeling via Drifting](https://arxiv.org/abs/2602.04770), followed by a didactic presentation of [Generative Drifting is Secretly Score Matching](https://arxiv.org/abs/2603.09936). The design follows a light “lab paper” language, with incremental builds and code-native animations throughout.

## Present

The MPS trajectories are loaded as local JSON, so serve the directory rather than opening `index.html` directly:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

- Arrow keys: advance slides and builds
- `R`: restart the current live animation
- `S`: speaker view / notes
- `F`: fullscreen

Reveal.js, KaTeX, and fonts load from CDNs; the trajectory data and every visual are local.

## Regenerate the 2D training runs

The checked-in `data/trajectories.json` contains three real training runs: between-mode, far-away, and collapsed initializations. Each is a tiny 2-layer MLP trained with the paper's kernel attraction-minus-repulsion target. Fixed noise probes are exported every 50 steps for coherent animation.

On Apple Silicon:

```bash
python3 -m venv .venv
uv pip install --python .venv/bin/python torch
.venv/bin/python scripts/train_toys.py --device mps
```

The browser presentation has no Python or PyTorch dependency.

## Files

- `index.html` — slide structure and speaker notes
- `css/theme.css` — 1920×1080 visual system and fragment styling
- `js/visuals.js` — live canvas/SVG animations and charts
- `js/deck.js` — Reveal.js bootstrap and controls
- `scripts/train_toys.py` — MPS toy-model training/export
- `scripts/qa_slides.mjs` — optional headless-Chrome overflow/screenshot QA
- `assets/paper/` — paper figures and matched ImageNet sample strips
- `assets/ATTRIBUTION.md` — licenses and credits for the real photographs on the feature-geometry slide
