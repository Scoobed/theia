#!/usr/bin/env python3
# Copyright 2026 Antrea Authors
# SPDX-License-Identifier: Apache-2.0
"""Regression checks for release image references and hardened runtime contracts."""
import pathlib
import subprocess
import yaml

ROOT = pathlib.Path(__file__).resolve().parents[1]
CHART = ROOT / "build/charts/theia"


def render(*args):
    result = subprocess.check_output(
        ["helm", "template", "theia", str(CHART), "-n", "flow-visibility", *args],
        text=True,
    )
    return [doc for doc in yaml.safe_load_all(result) if doc]


def images(value):
    if isinstance(value, dict):
        for key, child in value.items():
            if key == "image" and isinstance(child, str):
                yield child
            else:
                yield from images(child)
    elif isinstance(value, list):
        for child in value:
            yield from images(child)


def find(docs, kind, name):
    return next(d for d in docs if d["kind"] == kind and d["metadata"]["name"] == name)


docs = render()
refs = set(images(docs))
version = yaml.safe_load((CHART / "Chart.yaml").read_text())["appVersion"]
for ref in refs:
    assert ref.startswith("ghcr.io/scoobed/theia-"), ref
    assert ref.endswith(f":{version}"), ref
assert len(refs) == 9, refs
chi = find(docs, "ClickHouseInstallation", "clickhouse")
server = chi["spec"]["templates"]["podTemplates"][-1]["spec"]["containers"][0]
assert any(e["name"] == "CLICKHOUSE_ALWAYS_RUN_INITDB_SCRIPTS" and e["value"] == "1"
           for e in server["env"])
assert "startupProbe" not in server
schema_job = find(docs, "Job", "theia-schema-ready")
assert schema_job["metadata"]["annotations"]["helm.sh/hook"] == "post-install,post-upgrade"
subprocess.run(["bash", "-n"],
               input=schema_job["spec"]["template"]["spec"]["containers"][0]["command"][-1],
               text=True, check=True)
grafana = find(docs, "Deployment", "grafana")["spec"]["template"]["spec"]
assert grafana["securityContext"]["runAsUser"] == 65532
assert grafana["initContainers"][0]["command"][2] == "65532:65532"
zookeeper = find(docs, "StatefulSet", "zookeeper")["spec"]["template"]["spec"]
assert zookeeper["securityContext"]["runAsUser"] == 65532
startup = zookeeper["containers"][0]["command"][-1]
assert "hostname -" not in startup and "/conf/zoo.cfg" not in startup.replace("/opt/zookeeper/conf/zoo.cfg", "")
subprocess.run(["bash", "-n"], input=startup, text=True, check=True)
for probe in ("readinessProbe", "livenessProbe"):
    command = zookeeper["containers"][0][probe]["exec"]["command"]
    assert "/dev/tcp/" in command[-1] and "nc " not in command[-1]

external = render("--set", "clickhouse.cluster.zookeeperHosts[0]=external.example")
assert not any(d["kind"] == "StatefulSet" and d["metadata"]["name"] == "zookeeper" for d in external)
render("--set", "clickhouse.service.secureConnection.enable=true")
render("--set", "clickhouse.storage.persistentVolumeClaimSpec=null")
render("--set", "clickhouse.cluster.replicas=2")
render("--set", "grafana.securityContext.runAsUser=65534",
       "--set", "grafana.securityContext.fsGroup=65534")
fallback = render("--set", "clickhouse.image.tag=",
                  "--set", "clickhouse.monitor.image.tag=",
                  "--set", "theiaManager.image.tag=")
assert set(images(fallback)) == refs
private = render(
    "--set", "imagePullSecrets[0].name=ghcr-pull",
    "--set", "altinity-clickhouse-operator.imagePullSecrets[0].name=ghcr-pull",
    "--set", "altinity-clickhouse-operator.crdHook.imagePullSecrets[0].name=ghcr-pull",
    "--set", "clickhouse.cluster.replicas=2",
)
for doc in private:
    if doc["kind"] in ("Deployment", "StatefulSet", "Job"):
        assert doc["spec"]["template"]["spec"]["imagePullSecrets"] == [{"name": "ghcr-pull"}]
    if doc["kind"] == "ClickHouseInstallation":
        for pod in doc["spec"]["templates"]["podTemplates"]:
            assert pod["spec"]["imagePullSecrets"] == [{"name": "ghcr-pull"}]
print("Release chart regression checks passed (9 versioned images, storage, TLS, external ZooKeeper, non-root, replicas, fallback tags).")
