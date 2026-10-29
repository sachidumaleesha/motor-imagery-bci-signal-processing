"""Export verified, compact datasets for the BCI replay dashboard.

The exporter never creates classifier predictions. Subject 1 Run 04 is joined
to the predictions and timings measured by the executed assignment notebook.
Other recordings provide signal and annotation replay only.
"""

from __future__ import annotations

import csv
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LOCAL_PACKAGES = ROOT / ".python-packages"
if LOCAL_PACKAGES.exists():
    sys.path.insert(0, str(LOCAL_PACKAGES))

import mne
import numpy as np
from mne.datasets import eegbci
from scipy.signal import butter, sosfilt


DATA_DIR = ROOT / "data" / "MNE-eegbci-data" / "files" / "eegmmidb" / "1.0.0"
RESULTS_DIR = ROOT / "results"
OUT_DIR = ROOT.parent / "public" / "data" / "dashboard"
OUT_DIR.mkdir(parents=True, exist_ok=True)

CHANNELS = [
    "Fp1", "Fp2", "F3", "Fz", "F4", "FC3", "FCz", "FC4",
    "C3", "Cz", "C4", "CP3", "CPz", "CP4", "P3", "P4",
]
SFREQ = 160.0
STEP = 10
FRAME_INTERVAL_MS = 1000 * STEP / SFREQ
SOS_SIGNAL = butter(4, [8, 30], btype="bandpass", fs=SFREQ, output="sos")
SOS_MU = butter(4, [8, 12], btype="bandpass", fs=SFREQ, output="sos")
SOS_BETA = butter(4, [16, 24], btype="bandpass", fs=SFREQ, output="sos")

DATASETS = [
    ("s001-r04", "Subject 1", "S001", 4, "verified-replay", "Verified streaming replay"),
    ("s001-r08", "Subject 1", "S001", 8, "training", "Imagery training session 1"),
    ("s001-r12", "Subject 1", "S001", 12, "training", "Imagery training session 2"),
    ("s001-r01", "Subject 1", "S001", 1, "calibration", "Eyes-open calibration"),
    ("s001-r02", "Subject 1", "S001", 2, "calibration", "Eyes-closed calibration"),
    ("s002-r04", "Subject 2", "S002", 4, "exploration", "New-subject imagery replay"),
    ("s002-r08", "Subject 2", "S002", 8, "exploration", "New-subject training replay"),
    ("s003-r04", "Subject 3", "S003", 4, "exploration", "Alternative-subject imagery replay"),
]


def write_json(path: Path, value: object) -> None:
    with path.open("w", encoding="utf-8") as handle:
        json.dump(value, handle, ensure_ascii=False, separators=(",", ":"))


def load_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def load_verified_stream() -> dict[int, dict[str, object]]:
    rows = load_csv(RESULTS_DIR / "stream_latency.csv")
    by_start: dict[int, dict[str, object]] = {}
    for row in rows:
        start = int(row["start_sample"])
        by_start[start] = {
            "rawPrediction": int(row["raw_prediction"]),
            "smoothedPrediction": int(row["smoothed_prediction"]),
            "latencyMs": round(float(row["latency_ms"]), 4),
            "queueDrop": row["simulated_queue_drop"].lower() == "true",
        }
    return by_start


def process_dataset(config: tuple[str, str, str, int, str, str], verified_stream: dict[int, dict[str, object]]):
    dataset_id, subject, subject_code, run, role, description = config
    edf_path = DATA_DIR / subject_code / f"{subject_code}R{run:02d}.edf"
    if not edf_path.exists():
        print(f"Skipping {dataset_id}: {edf_path.name} was not found")
        return None

    raw = mne.io.read_raw_edf(edf_path, preload=True, verbose="ERROR")
    eegbci.standardize(raw)
    raw.pick(CHANNELS).reorder_channels(CHANNELS)
    if not np.isclose(raw.info["sfreq"], SFREQ):
        raise ValueError(f"{edf_path.name} uses {raw.info['sfreq']} Hz; expected {SFREQ} Hz")

    raw_data = raw.get_data()
    filtered = sosfilt(SOS_SIGNAL, raw_data, axis=-1) * 1e6
    mu = sosfilt(SOS_MU, raw_data, axis=-1)
    beta = sosfilt(SOS_BETA, raw_data, axis=-1)
    sample_count = raw_data.shape[1]

    ground_truth = np.full(sample_count, "rest", dtype=object)
    trials = []
    for annotation in raw.annotations:
        label = "left" if annotation["description"] == "T1" else "right" if annotation["description"] == "T2" else "rest"
        onset = float(annotation["onset"])
        duration = float(annotation["duration"])
        start = int(round(onset * SFREQ))
        stop = min(sample_count, int(round((onset + duration) * SFREQ)))
        ground_truth[start:stop] = label
        if label != "rest":
            trials.append({
                "onset": round(onset, 3),
                "duration": round(duration, 3),
                "label": label,
            })

    c3 = CHANNELS.index("C3")
    c4 = CHANNELS.index("C4")
    frames = []
    is_verified = dataset_id == "s001-r04"
    for start in range(0, sample_count, STEP):
        stop = min(start + STEP, sample_count)
        window_start = max(0, stop - int(0.5 * SFREQ))
        measured = verified_stream.get(start) if is_verified else None
        if is_verified and measured is None:
            raise ValueError(f"Missing measured stream row for sample {start}")
        frames.append({
            "t": round(start / SFREQ, 4),
            "signal": [round(float(value), 3) for value in filtered[:, start:stop].mean(axis=1)],
            "power": [
                round(float(np.mean(mu[c3, window_start:stop] ** 2 * 1e12)), 4),
                round(float(np.mean(mu[c4, window_start:stop] ** 2 * 1e12)), 4),
                round(float(np.mean(beta[c3, window_start:stop] ** 2 * 1e12)), 4),
                round(float(np.mean(beta[c4, window_start:stop] ** 2 * 1e12)), 4),
            ],
            "groundTruth": str(ground_truth[start]),
            "rawPrediction": measured["rawPrediction"] if measured else None,
            "smoothedPrediction": measured["smoothedPrediction"] if measured else None,
            "latencyMs": measured["latencyMs"] if measured else None,
            "queueDrop": measured["queueDrop"] if measured else None,
        })

    capabilities = {
        "waveform": True,
        "annotations": bool(trials),
        "verifiedPredictions": is_verified,
        "measuredLatency": is_verified,
    }
    metadata = {
        "id": dataset_id,
        "name": f"{subject} - Run {run:02d}",
        "subject": subject,
        "subjectCode": subject_code,
        "run": run,
        "role": role,
        "description": description,
        "sourceFile": edf_path.name,
        "sampleRateHz": SFREQ,
        "frameIntervalMs": FRAME_INTERVAL_MS,
        "durationSeconds": round(sample_count / SFREQ, 3),
        "frameCount": len(frames),
        "channels": CHANNELS,
        "capabilities": capabilities,
    }
    dataset = {**metadata, "trials": trials, "frames": frames}
    output_name = f"{dataset_id}.json"
    write_json(OUT_DIR / output_name, dataset)
    print(f"Exported {dataset_id}: {len(frames)} frames from {edf_path.name}")
    return {**metadata, "dataUrl": f"/data/dashboard/{output_name}"}


def main() -> None:
    verified_stream = load_verified_stream()
    manifest_items = []
    for config in DATASETS:
        item = process_dataset(config, verified_stream)
        if item:
            manifest_items.append(item)

    if len(verified_stream) != 2000:
        raise ValueError(f"Expected 2000 measured stream rows, found {len(verified_stream)}")

    with (RESULTS_DIR / "summary.json").open(encoding="utf-8") as handle:
        summary = json.load(handle)
    analysis = {
        "cv": summary["cv"],
        "timing": summary["timing"],
        "stream": summary["stream"],
        "alphaErd": summary["alpha_erd"],
        "bandComparison": load_csv(RESULTS_DIR / "band_comparison.csv"),
        "notes": {
            "replay": "Recorded replay, not a physical EEG headset connection.",
            "brain": "Approximate contralateral hemisphere, not an EEG source map.",
            "csp": "CSP patterns are scalp projections and remain the spatial analysis result.",
        },
    }
    write_json(OUT_DIR / "analysis.json", analysis)
    write_json(OUT_DIR / "manifest.json", {"schemaVersion": 1, "datasets": manifest_items})
    shutil.copy2(RESULTS_DIR / "figures" / "csp_patterns.png", OUT_DIR / "csp-patterns.png")
    print(f"Dashboard files written to {OUT_DIR}")


if __name__ == "__main__":
    main()
