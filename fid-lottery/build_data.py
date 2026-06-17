#!/usr/bin/env python3
"""Extract all numeric data the FID-Lottery website needs into a single
self-contained JS file (window.FL = {...}) plus mirror JSON files.

Sources: paper_data/01_baseline_25x10/*.json and figures/fig_data/*.tsv.
Run from anywhere; paths are resolved relative to the repo root (two
levels up handling: this file lives in website/)."""
import json, os, csv, math

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FIG  = os.path.join(ROOT, "figures", "fig_data")
PD   = os.path.join(ROOT, "paper_data", "01_baseline_25x10")
OUTD = os.path.join(HERE, "data")
os.makedirs(OUTD, exist_ok=True)


def r(x, n=4):
    try:
        return round(float(x), n)
    except (TypeError, ValueError):
        return x


def read_tsv(name):
    path = os.path.join(FIG, name)
    with open(path) as f:
        return list(csv.DictReader(f, delimiter="\t"))


# ---------------------------------------------------------------- baseline
raw = json.load(open(os.path.join(PD, "legacy_raw_data.json")))
tstats = json.load(open(os.path.join(PD, "legacy_training_stats.json")))
order = tstats["models"]  # 25 seeds in canonical order

panel = []
for key in order:
    rec = raw[key]
    fids = [r(v, 4) for v in rec["inception"]]
    m = sum(fids) / len(fids)
    panel.append({
        "seed": int(key.replace("seed_", "")),
        "fids": fids,
        "sseeds": [int(s) for s in rec.get("sampling_seeds", [])],
        "mean": r(m, 4),
        "min": r(min(fids), 4),
        "max": r(max(fids), 4),
    })

# jackpot / luck thresholds over ALL 25*10 (train,sample) cells
all_cells = sorted(v for p in panel for v in p["fids"])
def quantile(q):
    if not all_cells:
        return None
    i = q * (len(all_cells) - 1)
    lo = int(math.floor(i)); hi = int(math.ceil(i))
    if lo == hi:
        return all_cells[lo]
    return all_cells[lo] + (all_cells[hi] - all_cells[lo]) * (i - lo)

inc = tstats["inception"]["of_means"]
baseline = {
    "panel": panel,
    "grand_mean": r(inc["mean"], 4),
    "sigma_between": 0.438,
    "sigma_within": 0.137,
    "cov_between": 1.26,
    "cov_within": 0.40,
    "ratio": 3.2,
    "ci95": r(inc["ci95"], 4),
    "n_train": 25,
    "n_sample": 10,
    "envelope_sigma": 0.44,
    "cell_min": r(all_cells[0], 4),
    "cell_max": r(all_cells[-1], 4),
    "cell_p05": r(quantile(0.05), 4),
    "cell_p10": r(quantile(0.10), 4),
    "cell_p25": r(quantile(0.25), 4),
}

# ----------------------------------------------------------- decomposition
bars = {row["condition"]: row for row in read_tsv("fig2b_bars.tsv")}
box  = {row["condition"]: row for row in read_tsv("fig2a_box.tsv")}
COND_ORDER = ["vary_all", "vary_noise", "vary_init", "vary_data"]
LABELS = {"vary_all": "All sources", "vary_noise": "Training noise",
          "vary_init": "Initialisation", "vary_data": "Data order"}
decomp = []
for c in COND_ORDER:
    b, bx = bars[c], box[c]
    strip = read_tsv(f"fig2a_strip_{c}.tsv")
    dots = [r(s["mean_inc"], 4) for s in strip]
    decomp.append({
        "key": c, "label": LABELS[c],
        "between": r(b["between_sigma"], 4),
        "within": r(b["within_sigma"], 4),
        "mean": r(bx["mean"], 4), "std": r(bx["std"], 4),
        "min": r(bx["min"], 4), "q1": r(bx["q1"], 4),
        "median": r(bx["median"], 4), "q3": r(bx["q3"], 4),
        "max": r(bx["max"], 4), "dots": dots,
    })
sb_all = decomp[0]["between"]
for d in decomp:
    d["pct_of_all"] = r(100.0 * d["between"] / sb_all, 0)
# naive quadrature sum of the 3 single sources
ssum = math.sqrt(decomp[1]["between"]**2 + decomp[2]["between"]**2 + decomp[3]["between"]**2)
decomposition = {"conditions": decomp, "naive_sum": r(ssum, 3), "observed_all": sb_all}

# ------------------------------------------------ scaling / variance / race
MODELS = ["DiT-S", "DiT-B", "DiT-L", "DiT-XL"]
DISPLAY = {"DiT-S": "SiT-S", "DiT-B": "SiT-B", "DiT-L": "SiT-L", "DiT-XL": "SiT-XL"}
PARAMS = {"DiT-S": "33M", "DiT-B": "130M", "DiT-L": "458M", "DiT-XL": "675M"}
SPEEDUP = {"DiT-S": 1.25, "DiT-B": 1.25, "DiT-L": 1.82, "DiT-XL": 2.0}

env_files = {"DiT-S": "fig6a_envelope_dits.tsv", "DiT-B": "fig6a_envelope_ditb.tsv",
             "DiT-L": "fig6a_envelope_ditl.tsv", "DiT-XL": "fig6a_envelope_ditxl.tsv"}

# individual seed trajectories
lines = {m: {} for m in MODELS}
for row in read_tsv("fig6a_lines.tsv"):
    m = row["model"]
    if m not in lines:
        continue
    lines[m].setdefault(row["seed"], []).append([int(float(row["step"])), r(row["fid"], 3)])

scaling = {}
for m in MODELS:
    summ = read_tsv(f"fig6_summary_{m}.tsv")
    env = read_tsv(env_files[m])
    steps = [int(float(s["step"])) for s in summ]
    scaling[m] = {
        "display": DISPLAY[m], "params": PARAMS[m], "speedup": SPEEDUP[m],
        "steps": steps,
        "mean": [r(s["mean"], 3) for s in summ],
        "std":  [r(s["std"], 4) for s in summ],
        "cov":  [r(s["cov_pct"], 3) for s in summ],
        "emin": [r(e["min"], 3) for e in env],
        "emax": [r(e["max"], 3) for e in env],
        "emean":[r(e["mean"], 3) for e in env],
        "seeds": {sid: sorted(pts) for sid, pts in lines[m].items()},
        "cov_2m": r(summ[-1]["cov_pct"], 2),
    }

# ----------------------------------------------------------------- golden
g_means = [r(row["mean_fid"], 4) for row in read_tsv("fig4_means.tsv")]
g_strip = [{"x": int(row["x"]), "xj": r(row["xj"], 3), "fid": r(row["fid"], 4)}
           for row in read_tsv("fig4_strip.tsv")]
bump_static = [{"x": int(row["x"]), "rank": int(row["rank"]), "seed": int(row["seed"])}
               for row in read_tsv("fig4_bump_static.tsv") if row.get("x")]
bump_moved  = [{"x": int(row["x"]), "rank": int(row["rank"]), "seed": int(row["seed"])}
               for row in read_tsv("fig4_bump_moved.tsv") if row.get("x")]
golden = {
    "gs_means": g_means,                       # sorted per-seed GS-FID means
    "gs_grand_mean": 7.42,
    "gs_sigma_between": 0.050, "gs_sigma_within": 0.027,
    "gs_cov": 0.67, "unguided_cov": 1.26,
    "spearman": 0.73, "ratio_after": 1.87,
    "strip": g_strip,
    "bump_static": bump_static, "bump_moved": bump_moved,
    "evals_per_cell": 14,
}

# -------------------------------------------------------------------- muP
mup = {}
for m in MODELS:
    gs = read_tsv(f"fig_mup_gs_{m}.tsv")
    ug = read_tsv(f"fig_mup_unguided_{m}.tsv")
    def pack(rows):
        return {
            "lr": [float(r_["lr"]) for r_ in rows],
            "mean": [r(r_["mean"], 3) for r_ in rows],
            "std": [r(r_["std"], 4) for r_ in rows],
            "cov": [r(r_["cov_pct"], 3) for r_ in rows],
            "ndiv": [int(r_["n_div"]) for r_ in rows],
        }
    mup[m] = {"display": DISPLAY[m], "gs": pack(gs), "unguided": pack(ug)}

# --------------------------------------------------------------- cov bands
bands = []
NICE = {"incfid": "Inception FID", "dinofid": "DINOv2 FID",
        "incprecision": "Precision", "increcall": "Recall",
        "incdensity": "Density", "inccoverage": "Coverage"}
for row in read_tsv("figS_cov_bands.tsv"):
    bands.append({
        "metric": row["metric"], "label": NICE.get(row["metric"], row["metric"]),
        "min": r(row["cov_min"], 3), "p10": r(row["cov_p10"], 3),
        "median": r(row["cov_median"], 3), "p90": r(row["cov_p90"], 3),
        "max": r(row["cov_max"], 3), "n": int(row["n_cells"]),
    })

FL = {
    "baseline": baseline,
    "decomposition": decomposition,
    "scaling": scaling,
    "models": MODELS,
    "golden": golden,
    "mup": mup,
    "covbands": bands,
}

# write individual JSON mirrors
for k, v in FL.items():
    with open(os.path.join(OUTD, f"{k}.json"), "w") as f:
        json.dump(v, f, separators=(",", ":"))

# write the self-contained JS bundle
jspath = os.path.join(HERE, "js", "data.js")
os.makedirs(os.path.dirname(jspath), exist_ok=True)
with open(jspath, "w") as f:
    f.write("// Auto-generated by website/build_data.py — do not edit by hand.\n")
    f.write("// All numeric data for the FID-Lottery site, inlined for file:// use.\n")
    f.write("window.FL = ")
    json.dump(FL, f, separators=(",", ":"))
    f.write(";\n")

print("baseline panel seeds:", len(panel))
print("decomp conditions:", [d["key"] for d in decomp], "naive_sum", decomposition["naive_sum"])
print("scaling models:", list(scaling.keys()), "XL cov@2M", scaling["DiT-XL"]["cov_2m"])
print("golden gs_means n:", len(g_means), "bump_moved n:", len(bump_moved))
print("mup models:", list(mup.keys()))
print("cov bands:", [b["metric"] for b in bands])
print("data.js bytes:", os.path.getsize(jspath))
