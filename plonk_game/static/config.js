/* Game configuration. Safe to be public (no secrets here). */
window.CONFIG = {
  ROUNDS_PER_GAME: 5,
  ROUND_SECONDS: 120, // 2 minutes per image
  DATA_DIR: "data",
  IMAGES_SUBDIR: "images",
  CSV_SUBDIR: "csv",
  MANIFEST: "data/manifest.json",

  // Data collection. Left null for now -> plays are stored in localStorage and
  // can be exported as a JSON file. Later, point this at a secret-holding proxy
  // (e.g. an HF Space) that writes to a HF dataset. The page never holds a token.
  DATA_ENDPOINT: null,

  // Map tiles (OpenStreetMap). Works on github.io.
  TILE_URL: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  TILE_ATTRIB:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};
