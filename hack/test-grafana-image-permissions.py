#!/usr/bin/env python3
# Copyright 2026 Antrea Authors
# SPDX-License-Identifier: Apache-2.0
"""Check embedded Grafana plugins and UID 101/default-UID access without a shell."""
import argparse
import json
import subprocess
import tarfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("image", nargs="?", default="theia-grafana-uid101:local")
args = parser.parse_args()
identities = [(101, 101), (65532, 65532)]
plugins = [
    "grafana-clickhouse-datasource",
    "theia-grafana-sankey-plugin",
    "theia-grafana-chord-plugin",
    "theia-grafana-dependency-plugin",
]


def accessible(entry, uid, gid, required):
    bits = ((entry.mode >> 6) if entry.uid == uid else
            (entry.mode >> 3) if entry.gid == gid else entry.mode) & 7
    return bits & required == required


cid = subprocess.check_output(["docker", "create", args.image], text=True).strip()
try:
    found = set()
    process = subprocess.Popen(["docker", "cp", cid + ":/opt/grafana/plugins", "-"],
                               stdout=subprocess.PIPE)
    with tarfile.open(fileobj=process.stdout, mode="r|") as archive:
        for entry in archive:
            required = 5 if entry.isdir() or "/gpx_clickhouse_linux_" in entry.name else 4
            if entry.isdir() or entry.isfile():
                for uid, gid in identities:
                    assert accessible(entry, uid, gid, required), (uid, entry.name, oct(entry.mode))
                assert not entry.mode & 0o022, ("Plugin path is group/world-writable", entry.name)
            if entry.isfile() and entry.name.endswith(("/plugin.json", "/module.js")):
                assert entry.size > 0, entry.name
                found.add(entry.name)
            if entry.isfile() and entry.name.endswith("/plugin.json"):
                manifest = json.load(archive.extractfile(entry))
                assert manifest["id"] == entry.name.split("/")[1]
    assert process.wait() == 0
    for plugin in plugins:
        for file in ("plugin.json", "module.js"):
            assert f"plugins/{plugin}/{file}" in found, (plugin, file)
    for path in ("/var/lib/grafana", "/var/log/grafana", "/tmp"):
        process = subprocess.Popen(["docker", "cp", cid + ":" + path, "-"],
                                   stdout=subprocess.PIPE)
        with tarfile.open(fileobj=process.stdout, mode="r|") as archive:
            root = next(iter(archive))
            assert root.isdir()
            for uid, gid in identities:
                assert accessible(root, uid, gid, 7), (uid, path, oct(root.mode))
            if path == "/tmp":
                assert (root.mode, root.uid, root.gid) == (0o1777, 0, 0)
            else:
                assert (root.mode, root.uid, root.gid) == (0o770, 101, 65532)
            # Drain the stream so docker cp can finish normally.
            for entry in archive:
                pass
        assert process.wait() == 0
finally:
    subprocess.run(["docker", "rm", "-v", cid], stdout=subprocess.DEVNULL, check=True)
for uid, gid in identities:
    output = subprocess.check_output([
        "docker", "run", "--rm", "--read-only", "--network", "none",
        "--user", f"{uid}:{gid}", "--entrypoint", "grafana", args.image,
        "cli", "--homepath", "/usr/share/grafana", "--pluginsDir",
        "/opt/grafana/plugins", "plugins", "ls",
    ], text=True)
    for plugin in plugins:
        assert plugin in output, (uid, plugin)
print("Grafana image permission checks passed for UID/GID 101:101 and 65532:65532.")
