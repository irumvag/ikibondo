"""
Restore the trained model binaries from the GitHub release.

The .pkl/.joblib artifacts are gitignored (pickle deserialization runs
arbitrary code, so binaries never live in the git history). The canonical
copies are attached to the `ml-models-v1` release on GitHub:

    https://github.com/irumvag/ikibondo/releases/tag/ml-models-v1

Usage (from the repo root or ml/):
    python ml/scripts/fetch_models.py

Downloads every artifact into its serving location and verifies each file
against SHA256SUMS.txt before moving it into place — a corrupted or
tampered download is rejected. ASCII-only output for Windows consoles.
"""
import hashlib
import shutil
import sys
import tempfile
import urllib.request
from pathlib import Path

RELEASE = 'ml-models-v1'
BASE = f'https://github.com/irumvag/ikibondo/releases/download/{RELEASE}'

# Repo root = two levels up from this file (ml/scripts/fetch_models.py)
ROOT = Path(__file__).resolve().parents[2]

# asset name -> destination path (relative to repo root)
ARTIFACTS = {
    'malnutrition_v1.pkl':         'ml/models/malnutrition_v1.pkl',
    'growth_nn_v1.pkl':            'ml/models/growth_nn_v1.pkl',
    'vaccination_rf_v1.pkl':       'ml/models/vaccination_rf_v1.pkl',
    'ikibondo_rf_pipeline.joblib': 'backend/apps/ml_engine/saved_models/ikibondo_rf_pipeline.joblib',
    'thresholds.joblib':           'backend/apps/ml_engine/saved_models/thresholds.joblib',
}


def download(url: str, dest: Path) -> None:
    with urllib.request.urlopen(url) as resp, open(dest, 'wb') as out:
        shutil.copyfileobj(resp, out)


def main() -> int:
    tmp = Path(tempfile.mkdtemp(prefix='ikibondo-models-'))

    print(f'Fetching checksums from release {RELEASE} ...')
    sums_file = tmp / 'SHA256SUMS.txt'
    download(f'{BASE}/SHA256SUMS.txt', sums_file)
    expected = {}
    for line in sums_file.read_text().splitlines():
        if line.strip():
            digest, name = line.split()
            expected[name] = digest

    failures = 0
    for name, rel_dest in ARTIFACTS.items():
        dest = ROOT / rel_dest
        staged = tmp / name
        print(f'  {name} ... ', end='', flush=True)
        try:
            download(f'{BASE}/{name}', staged)
        except Exception as exc:  # noqa: BLE001 - report and continue
            print(f'DOWNLOAD FAILED ({exc})')
            failures += 1
            continue

        digest = hashlib.sha256(staged.read_bytes()).hexdigest()
        if name not in expected:
            print('NO CHECKSUM IN MANIFEST - skipped')
            failures += 1
            continue
        if digest != expected[name]:
            print('CHECKSUM MISMATCH - rejected (not installed)')
            failures += 1
            continue

        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(staged), str(dest))
        print(f'OK -> {rel_dest}')

    shutil.rmtree(tmp, ignore_errors=True)
    if failures:
        print(f'\n{failures} artifact(s) failed - see above.')
        return 1
    print('\nAll model artifacts restored and verified.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
