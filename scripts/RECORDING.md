# Recording the MIRO animations to MP4

Two paths. Pick whichever you prefer.

The animations are in `miro/assets/js/`:
`miro_animation.js` (training pipeline), `inference_animation.js` (inference
pipeline), `reward_tradeoff_animation.js`, `theory_animation.js` (log-odds
landscape).

---

## A. One-click in-browser recorder *(no tooling needed)*

A standalone page at `miro/record.html` plays a single animation full-bleed
with a small toolbar for recording.

1. Serve the `miro/` directory locally:

   ```sh
   cd miro
   python3 -m http.server 4173
   ```

2. Open <http://127.0.0.1:4173/record.html>

3. In the toolbar at the top, pick an animation, width/height, duration
   (seconds), then click **● Record**. The page downloads a WebM file when
   the timer runs out.

   - Press `T` to toggle the toolbar (useful before recording so it doesn't
     appear on screen).
   - Press `R` to start/stop recording.

4. Convert the WebM to MP4 (universal social format):

   ```sh
   ffmpeg -i miro-theory-1280x720-60fps.webm \
          -c:v libx264 -pix_fmt yuv420p -crf 18 -movflags +faststart \
          miro-theory.mp4
   ```

   Install ffmpeg via `brew install ffmpeg` if you don't have it.

Tips:

- Twitter/X likes 1280×720 H.264 MP4 (≤2:20 long).
- LinkedIn likes 1920×1080 H.264 MP4.
- Square / vertical formats: record at the natural canvas size, then add bars
  with ffmpeg, e.g. for a 1080×1080 social-square crop with letterbox:

  ```sh
  ffmpeg -i in.mp4 -vf "scale=1080:-2,pad=1080:1080:0:(1080-ih)/2:color=#0b0c10" out.mp4
  ```

- The browser tab must remain visible while recording (don't switch tabs).
- Chrome/Edge produce the cleanest output. Safari works but is slower.

---

## B. Batch script *(node + ffmpeg)*

`scripts/record-miro-animations.js` drives the same `record.html` page via
headless Chrome and produces an `.mp4` for each animation in one go.

Prereqs:

```sh
brew install ffmpeg                       # if missing
cd scripts && npm install puppeteer        # or `npm install puppeteer@latest`
```

Run a local server, then the script:

```sh
# Terminal 1
cd miro && python3 -m http.server 4173

# Terminal 2
node scripts/record-miro-animations.js                            # all four
node scripts/record-miro-animations.js theory                     # just one
node scripts/record-miro-animations.js --width 1920 --height 1080 # 1080p
```

Output lands in `recordings/` at the repo root.

Common flags:

| Flag             | Meaning                                                    |
| ---------------- | ---------------------------------------------------------- |
| `--width N`      | Output width (default 1280)                                |
| `--height N`     | Output height (default 720)                                |
| `--duration N`   | Recording length in seconds (default per-animation)        |
| `--fps N`        | Capture frame rate (default 60)                            |
| `--url URL`      | Base URL of the local server (default `127.0.0.1:4173`)    |
| `--out PATH`     | Output directory (default `recordings/`)                   |
| `--keep-webm`    | Keep the intermediate WebM alongside the MP4               |

The script:

1. Launches headless Chrome at the requested resolution.
2. Loads `record.html?animation=X&auto=1` — the page auto-starts recording.
3. Waits for the WebM download to land in the output dir.
4. Re-encodes to H.264 MP4 with `crf 17`, `preset slow`, `+faststart`.
