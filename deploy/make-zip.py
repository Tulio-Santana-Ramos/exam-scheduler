#!/usr/bin/env python3
"""Builds the delivery zip from the files git would include (tracked + untracked, minus ignored).

Refuses to finish if an env file, key file or any real secret value from deploy/.env.* ends up inside.
Usage: python3 deploy/make-zip.py [output.zip]
"""
import re
import subprocess
import sys
import zipfile
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / "exam-scheduler-delivery.zip"
PREFIX = "exam-scheduler/"

BAD_NAME = re.compile(r"(^|/)(\.env(\..+)?|.*\.(pem|key|p12)|.*credentials.*|id_rsa.*)$", re.I)
ALLOWED = {".env.example"}
BAD_DIRS = ("node_modules/", "graphify-out/", "dist/", ".git/")


def listed_files() -> list[str]:
    out = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        cwd=ROOT, check=True, capture_output=True,
    ).stdout.decode()
    return sorted(p for p in out.split("\0") if p and (ROOT / p).is_file())


def secret_values() -> set[str]:
    values: set[str] = set()
    for name in ("deploy/.env.api", "deploy/.env.migrate", "deploy/.env.hosting"):
        path = ROOT / name
        if not path.exists():
            continue
        for line in path.read_text().splitlines():
            if "=" not in line or line.lstrip().startswith("#"):
                continue
            key, value = line.split("=", 1)
            if key in {"DATABASE_URL", "JWT_SECRET", "LOKI_API_KEY"} and len(value) >= 8:
                values.add(value)
                if key == "DATABASE_URL":
                    parsed = urlparse(value)
                    values.update(v for v in (parsed.password, parsed.hostname) if v and len(v) >= 8)
            if key in {"GCP_PROJECT_ID", "NEON_PROJECT_ID"} and len(value) >= 8:
                values.add(value)
    return values


def main() -> None:
    files = listed_files()
    problems = []
    for rel in files:
        name = rel.split("/")[-1]
        if rel.startswith(BAD_DIRS) or any(f"/{d}" in f"/{rel}" for d in BAD_DIRS):
            problems.append(f"forbidden location: {rel}")
        elif BAD_NAME.search(rel) and name not in ALLOWED:
            problems.append(f"sensitive file name: {rel}")
    secrets = secret_values()
    for rel in files:
        data = (ROOT / rel).read_bytes()
        for value in secrets:
            if value.encode() in data:
                problems.append(f"secret value found in {rel}")
                break
    if problems:
        print("REFUSING TO BUILD:\n  " + "\n  ".join(problems))
        sys.exit(1)

    if OUT.exists():
        OUT.unlink()
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as archive:
        for rel in files:
            archive.write(ROOT / rel, PREFIX + rel)
    print(f"wrote {OUT} ({OUT.stat().st_size / 1024:.0f} KiB, {len(files)} files); checked against {len(secrets)} secret values: clean")


main()
