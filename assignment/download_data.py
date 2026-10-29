"""Prefetch the five public EDFs with bounded timeouts and MNE registry checksums."""
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
from importlib.resources import files
from pathlib import Path
import requests

root = Path(__file__).resolve().parent / "data" / "MNE-eegbci-data" / "files" / "eegmmidb" / "1.0.0"
registry = {}
for line in files("mne").joinpath("data", "eegbci_checksums.txt").read_text().splitlines():
    if line.strip() and not line.startswith("#"):
        name, digest = line.split()[:2]
        registry[name] = digest.removeprefix("sha256:")

def fetch(run):
    name = f"S001/S001R{run:02d}.edf"
    target = root / name
    if target.exists() and sha256(target.read_bytes()).hexdigest() == registry[name]:
        return f"Verified cached {name}"
    # Public AWS mirror linked by the official PhysioNet dataset page.
    url = "https://physionet-open.s3.amazonaws.com/eegmmidb/1.0.0/" + name
    response = requests.get(url, timeout=(10, 45))
    response.raise_for_status()
    data = response.content
    if sha256(data).hexdigest() != registry[name]:
        raise ValueError(f"Checksum mismatch for {name}")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return f"Downloaded and SHA-256 verified {name}: {len(data)} bytes"

with ThreadPoolExecutor(max_workers=3) as executor:
    for result in executor.map(fetch, [1, 2, 8, 12, 4]):
        print(result, flush=True)
