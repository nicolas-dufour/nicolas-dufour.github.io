/* Scoring + CSV parsing, all client-side.
 *
 * Faithful to nicolas-dufour/plonk:
 *   haversine: earth radius 6371 km, standard formula (inputs in degrees here,
 *              converted to radians internally).
 *   geoscore : 5000 * exp(-distance_km / 1492.7), range [0, 5000].
 */
window.GEO = (function () {
  const EARTH_RADIUS_KM = 6371.0;
  const GEOSCORE_SCALE_KM = 1492.7;
  const GEOSCORE_MAX = 5000.0;
  const toRad = (d) => (d * Math.PI) / 180;

  function haversineKm(lat1, lon1, lat2, lon2) {
    const rlat1 = toRad(lat1);
    const rlat2 = toRad(lat2);
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    let a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(rlat1) * Math.cos(rlat2) * Math.sin(dLon / 2) ** 2;
    a = Math.min(1, Math.max(0, a));
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_KM * c;
  }

  function geoscore(distanceKm) {
    return GEOSCORE_MAX * Math.exp(-distanceKm / GEOSCORE_SCALE_KM);
  }

  /* RFC-4180-ish CSV parser. Handles quoted fields with embedded commas,
   * newlines and escaped double-quotes (""). Returns an array of string rows. */
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    let i = 0;
    const n = text.length;
    let sawAny = false;
    while (i < n) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i++;
          continue;
        }
        field += c;
        i++;
        continue;
      }
      if (c === '"') {
        inQuotes = true;
        sawAny = true;
        i++;
        continue;
      }
      if (c === ",") {
        row.push(field);
        field = "";
        sawAny = true;
        i++;
        continue;
      }
      if (c === "\r") {
        i++;
        continue;
      }
      if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        sawAny = false;
        i++;
        continue;
      }
      field += c;
      sawAny = true;
      i++;
    }
    if (sawAny || field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }

  function toNum(s) {
    if (s === undefined || s === null) return null;
    const t = String(s).trim();
    if (t === "") return null;
    const v = Number(t);
    return Number.isFinite(v) ? v : null;
  }

  /* Best-effort extraction of a model's "reasoning" string from raw_text. */
  function extractReasoning(raw) {
    if (!raw) return "";
    let txt = String(raw).trim();
    if (txt.startsWith("```")) {
      txt = txt.replace(/^```[a-zA-Z]*\s*/, "").replace(/\s*```$/, "").trim();
    }
    try {
      const obj = JSON.parse(txt);
      if (obj && typeof obj === "object" && obj.reasoning) {
        return String(obj.reasoning).trim();
      }
    } catch (e) {
      /* fall through to regex */
    }
    const m = txt.match(/"reasoning"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (m) {
      try {
        return JSON.parse('"' + m[1] + '"');
      } catch (e) {
        return m[1];
      }
    }
    return "";
  }

  /* Parse a per-image CSV into { ground_truth, methods, valid_methods }.
   * Each method gets distance_km + geoscore vs ground truth. */
  function parseRecord(csvText, imageId) {
    const rows = parseCSV(csvText);
    if (!rows.length) return null;
    const header = rows[0].map((h) => h.trim());
    const col = {};
    header.forEach((h, idx) => (col[h] = idx));
    const get = (r, name) => (col[name] != null ? r[col[name]] : undefined);

    let groundTruth = null;
    const methods = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;
      const source = (get(row, "source") || "").trim();
      if (!source) continue;
      const lat = toNum(get(row, "lat"));
      const lon = toNum(get(row, "lon"));
      if (source === "GROUND_TRUTH") {
        groundTruth = {
          lat: lat,
          lon: lon,
          label: (get(row, "raw_text") || "").trim(),
        };
        continue;
      }
      const setup = (get(row, "setup") || "").trim();
      const ok = (get(row, "ok") || "").trim().toLowerCase() === "true";
      const fallback =
        (get(row, "fallback_00") || "").trim().toLowerCase() === "true";
      const valid = lat !== null && lon !== null;
      methods.push({
        source: source,
        setup: setup,
        name: source + (setup ? " · " + setup : ""),
        lat: lat,
        lon: lon,
        ok: ok,
        fallback_00: fallback,
        valid: valid,
        country: (get(row, "pred_country") || "").trim(),
        reasoning: extractReasoning(get(row, "raw_text")),
        cost_usd: toNum(get(row, "cost_usd")),
        latency_s: toNum(get(row, "latency_s")),
      });
    }

    if (!groundTruth || groundTruth.lat === null || groundTruth.lon === null) {
      return null;
    }

    for (const m of methods) {
      if (m.valid) {
        m.distance_km = haversineKm(m.lat, m.lon, groundTruth.lat, groundTruth.lon);
        m.geoscore = geoscore(m.distance_km);
      } else {
        m.distance_km = null;
        m.geoscore = 0;
      }
    }

    const validMethods = methods
      .filter((m) => m.valid)
      .sort((a, b) => b.geoscore - a.geoscore);
    validMethods.forEach((m, idx) => (m.rank = idx + 1));

    return {
      image_id: imageId,
      ground_truth: groundTruth,
      methods: methods,
      valid_methods: validMethods,
    };
  }

  return { haversineKm, geoscore, parseCSV, parseRecord, extractReasoning };
})();
