#!/usr/bin/env python3
# Copyright 2026 Antrea Authors
# SPDX-License-Identifier: Apache-2.0
"""Scan release images and fail if any reported CVE is in CISA KEV."""
import collections
import json
import os
import pathlib
import subprocess
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
VERSION = (ROOT / "VERSION").read_text().strip().removeprefix("v")
REGISTRY = os.environ.get("DOCKER_REGISTRY", "ghcr.io/scoobed")
OUT = pathlib.Path(os.environ.get("SCAN_OUTPUT_DIR", "/tmp/theia-release-scans")) / VERSION
OUT.mkdir(parents=True, exist_ok=True)
NAMES = [
    "manager", "clickhouse-monitor", "clickhouse-server", "grafana",
    "clickhouse-operator", "metrics-exporter", "zookeeper", "init", "kubectl",
]
with urllib.request.urlopen(
    "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
    timeout=60,
) as response:
    kev = json.load(response)
(OUT / "kev.json").write_text(json.dumps(kev))
known = {v["cveID"] for v in kev["vulnerabilities"]}
summary = {}
blocked = False
for name in NAMES:
    image = f"{REGISTRY}/theia-{name}:{VERSION}"
    report = OUT / f"theia-{name}.json"
    subprocess.run(
        ["trivy", "image", "--scanners", "vuln", "--format", "json",
         "--output", str(report), image],
        check=True,
    )
    data = json.loads(report.read_text())
    findings = [v for r in data.get("Results", []) for v in r.get("Vulnerabilities", [])]
    kev_hits = sorted({v["VulnerabilityID"] for v in findings} & known)
    # Embedded SBOMs may repeat a package already found in an executable.
    unique = {
        (v["VulnerabilityID"], v["PkgName"], v["InstalledVersion"].lstrip("v")): v
        for v in findings
    }
    counts = dict(collections.Counter(v["Severity"] for v in unique.values()))
    summary[image] = {"severityCounts": counts, "kev": kev_hits}
    print(image, json.dumps(summary[image]), flush=True)
    blocked |= bool(kev_hits)
(OUT / "summary.json").write_text(json.dumps(summary, indent=2))
print(f"Reports: {OUT}")
if blocked:
    raise SystemExit("Publishing blocked: scanner findings include CISA KEV entries.")
