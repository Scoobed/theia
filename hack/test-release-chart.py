#!/usr/bin/env python3
# Copyright 2026 Antrea Authors
# SPDX-License-Identifier: Apache-2.0
"""Regression checks for release image references and hardened runtime contracts."""
import json
import pathlib
import re
import shutil
import subprocess
import tempfile
import yaml

ROOT = pathlib.Path(__file__).resolve().parents[1]
CHART = ROOT / "build/charts/theia"


def render(*args, namespace="flow-visibility", chart=CHART):
    result = subprocess.check_output(
        ["helm", "template", "theia", str(chart), "-n", namespace, *args],
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

def datasource(docs):
    config = find(docs, "ConfigMap", "grafana-datasource-provider")
    return yaml.safe_load(config["data"]["datasource_provider.yaml"])["datasources"][0]


def datasource_checksum(docs):
    deployment = find(docs, "Deployment", "grafana")
    return deployment["spec"]["template"]["metadata"]["annotations"]["checksum/datasource-provisioning"]


def check_dashboard_uids(value, uid):
    if isinstance(value, dict):
        if value.get("type") == "grafana-clickhouse-datasource":
            assert value.get("uid") == uid
        for child in value.values():
            check_dashboard_uids(child, uid)
    elif isinstance(value, list):
        for child in value:
            check_dashboard_uids(child, uid)


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
grafana_deployment = find(docs, "Deployment", "grafana")
assert grafana_deployment["spec"]["replicas"] == 1
assert grafana_deployment["spec"]["strategy"]["type"] == "Recreate"
assert grafana_deployment["spec"]["strategy"]["rollingUpdate"] is None
grafana = grafana_deployment["spec"]["template"]["spec"]
assert grafana["securityContext"]["runAsUser"] == 65532
assert grafana["initContainers"][0]["command"][2] == "65532:65532"
ds = datasource(docs)
assert ds["uid"] == "PDEE91DDB90597936"
assert ds["jsonData"]["host"] == "clickhouse-clickhouse.flow-visibility.svc"
assert ds["jsonData"]["port"] == 9000
assert ds["jsonData"]["protocol"] == "native"
assert ds["jsonData"]["defaultDatabase"] == "default"
assert "server" not in ds["jsonData"] and "url" not in ds
assert ds["jsonData"]["username"] == "$CLICKHOUSE_USERNAME"
assert ds["secureJsonData"]["password"] == "$CLICKHOUSE_PASSWORD"
env = {entry["name"]: entry for entry in grafana["containers"][0]["env"]}
for name, key in (("CLICKHOUSE_USERNAME", "username"), ("CLICKHOUSE_PASSWORD", "password")):
    assert env[name]["valueFrom"]["secretKeyRef"] == {"name": "clickhouse-secret", "key": key}
for dashboard in (CHART / "provisioning/dashboards").glob("*.json"):
    check_dashboard_uids(json.loads(dashboard.read_text()), ds["uid"])
checksum = datasource_checksum(docs)
assert re.fullmatch(r"[0-9a-f]{64}", checksum)
assert datasource_checksum(render()) == checksum
assert datasource_checksum(render("--set", "grafana.log.level=debug")) == checksum
assert datasource_checksum(render("--set", "clickhouse.service.tcpPort=19000")) != checksum
custom = render("--set", "clickhouse.service.tcpPort=19000", namespace="observability")
assert datasource(custom)["jsonData"]["host"] == "clickhouse-clickhouse.observability.svc"
assert datasource(custom)["jsonData"]["port"] == 19000
assert datasource_checksum(custom) != checksum
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
with tempfile.TemporaryDirectory(prefix="theia-chart-metadata-") as folder:
    chart = pathlib.Path(folder) / "theia"
    shutil.copytree(CHART, chart)
    metadata = yaml.safe_load((chart / "Chart.yaml").read_text())
    for packaged_version in ("0.9.3+b36edc5f0ba6", metadata["version"] + "+release.1"):
        metadata["version"] = packaged_version
        (chart / "Chart.yaml").write_text(yaml.safe_dump(metadata, sort_keys=False))
        rendered = render("--set", "clickhouse.cluster.replicas=2", chart=chart)
        chi = find(rendered, "ClickHouseInstallation", "clickhouse")
        for pod in chi["spec"]["templates"]["podTemplates"]:
            container = next(c for c in pod["spec"]["containers"] if c["name"] == "clickhouse")
            target = next(e["value"] for e in container["env"] if e["name"] == "THEIA_VERSION")
            assert target == packaged_version.split("+", 1)[0], target
print("Release chart regression checks passed (image tags, datasource provisioning, rollout checksums, storage, TLS, replicas, and migration build metadata).")
