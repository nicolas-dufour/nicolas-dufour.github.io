#!/usr/bin/env python3
"""Train tiny 2-D Drifting Models and export coherent presentation trajectories.

The deck never executes Python. It reads the JSON produced here and interpolates
between saved checkpoints in the browser. The implementation intentionally keeps
the paper's core loop visible: generate negatives, estimate attraction and
repulsion with a kernel, freeze x + V, and regress the generator toward it.
"""

from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

import torch
from torch import nn


class Generator(nn.Module):
    def __init__(self, bias: tuple[float, float]) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(2, 96),
            nn.SiLU(),
            nn.Linear(96, 96),
            nn.SiLU(),
            nn.Linear(96, 2),
        )
        # Start as a small, coherent cloud around the requested hard case.
        last = self.net[-1]
        assert isinstance(last, nn.Linear)
        nn.init.normal_(last.weight, std=0.012)
        nn.init.constant_(last.bias, 0.0)
        with torch.no_grad():
            last.bias.copy_(torch.tensor(bias))

    def forward(self, z: torch.Tensor) -> torch.Tensor:
        return self.net(z)


def target_samples(n: int, device: torch.device, generator: torch.Generator) -> torch.Tensor:
    """Balanced, slightly tilted two-mode target used throughout the tutorial."""
    mode = torch.randint(0, 2, (n,), device=device, generator=generator)
    centers = torch.tensor([[-1.55, -0.18], [1.55, 0.18]], device=device)
    points = centers[mode] + 0.34 * torch.randn(n, 2, device=device, generator=generator)
    # Give each mode a small opposite tilt so the target is not just two circles.
    tilt = torch.where(mode[:, None] == 0, torch.tensor([0.18, 0.32], device=device),
                       torch.tensor([-0.18, -0.32], device=device))
    points[:, 1:2] += tilt[:, 0:1] * points[:, 0:1] + 0.08 * tilt[:, 1:2]
    return points


@torch.no_grad()
def drifting_field(
    x: torch.Tensor,
    positives: torch.Tensor,
    tau: float,
    drift_scale: float,
) -> torch.Tensor:
    """Kernel mean-shift attraction minus leave-one-out repulsion."""
    pos_dist = torch.cdist(x, positives)
    pos_w = torch.softmax(-pos_dist / tau, dim=1)
    pos_mean = pos_w @ positives
    attraction = pos_mean - x

    neg_dist = torch.cdist(x, x)
    eye = torch.eye(x.shape[0], device=x.device, dtype=torch.bool)
    neg_dist = neg_dist.masked_fill(eye, float("inf"))
    neg_w = torch.softmax(-neg_dist / tau, dim=1)
    neg_mean = neg_w @ x
    repulsion = neg_mean - x

    return drift_scale * (attraction - repulsion)


def frame(model: nn.Module, probes: torch.Tensor) -> list[list[float]]:
    with torch.no_grad():
        values = model(probes).detach().cpu().tolist()
    return [[round(float(x), 4), round(float(y), 4)] for x, y in values]


def train_case(
    name: str,
    bias: tuple[float, float],
    seed: int,
    steps: int,
    save_every: int,
    device: torch.device,
) -> dict:
    random.seed(seed)
    torch.manual_seed(seed)
    if device.type == "mps":
        torch.mps.manual_seed(seed)

    model = Generator(bias).to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=1.8e-3, betas=(0.9, 0.98), weight_decay=1e-5)

    probe_gen = torch.Generator(device=device).manual_seed(20260204)
    probes = torch.randn(180, 2, device=device, generator=probe_gen)
    data_gen = torch.Generator(device=device).manual_seed(seed + 17)

    frames: list[list[list[float]]] = [frame(model, probes)]
    losses: list[float] = []
    drift_norms: list[float] = []
    checkpoint_steps: list[int] = [0]

    for step in range(1, steps + 1):
        # A mild large-to-small temperature schedule first sees the global shape,
        # then sharpens local interactions. This makes the hard collapsed start
        # both legible and stable in a small educational run.
        progress = step / steps
        tau = 1.45 * (1.0 - progress) + 0.52 * progress
        drift_scale = 0.62 * (1.0 - 0.35 * progress)

        z = torch.randn(256, 2, device=device, generator=data_gen)
        positives = target_samples(256, device, data_gen)
        x = model(z)
        v = drifting_field(x.detach(), positives, tau=tau, drift_scale=drift_scale)
        target = (x.detach() + v).detach()
        loss = (x - target).square().sum(dim=1).mean()

        opt.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 4.0)
        opt.step()

        if step % save_every == 0 or step == steps:
            frames.append(frame(model, probes))
            losses.append(round(float(loss.detach().cpu()), 7))
            drift_norms.append(round(float(v.square().sum(dim=1).mean().sqrt().cpu()), 7))
            checkpoint_steps.append(step)

    return {
        "name": name,
        "seed": seed,
        "bias": list(bias),
        "steps": checkpoint_steps,
        "loss": losses,
        "drift_norm": drift_norms,
        "frames": frames,
    }


def fixed_target(seed: int = 41, n: int = 240) -> list[list[float]]:
    # Generate target points on CPU so the JSON remains stable across backends.
    g = torch.Generator(device="cpu").manual_seed(seed)
    pts = target_samples(n, torch.device("cpu"), g).tolist()
    return [[round(float(x), 4), round(float(y), 4)] for x, y in pts]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--steps", type=int, default=1800)
    parser.add_argument("--save-every", type=int, default=50)
    parser.add_argument("--device", choices=("mps", "cpu"), default="mps")
    parser.add_argument("--out", type=Path, default=Path("data/trajectories.json"))
    args = parser.parse_args()

    if args.device == "mps" and not torch.backends.mps.is_available():
        raise SystemExit("MPS requested but unavailable. Run outside the restricted sandbox on Apple Silicon.")
    device = torch.device(args.device)

    cases = [
        ("between", (0.0, 0.0), 11),
        ("far", (0.0, 2.75), 23),
        ("collapsed", (-1.55, -0.18), 37),
    ]
    payload = {
        "meta": {
            "device": args.device,
            "steps": args.steps,
            "save_every": args.save_every,
            "algorithm": "kernel attraction - leave-one-out repulsion; stop-gradient target",
        },
        "target": fixed_target(),
        "runs": [
            train_case(name, bias, seed, args.steps, args.save_every, device)
            for name, bias, seed in cases
        ],
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(payload, separators=(",", ":")))
    size_kb = args.out.stat().st_size / 1024
    print(f"wrote {args.out} ({size_kb:.1f} KiB) on {device}")
    for run in payload["runs"]:
        print(run["name"], "final loss", run["loss"][-1], "final drift", run["drift_norm"][-1])


if __name__ == "__main__":
    main()
