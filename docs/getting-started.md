# Getting Started with Theia

## Table of Contents

<!-- toc -->
- [Overview](#overview)
- [Prerequisites](#prerequisites)
  - [Configuration](#configuration)
    - [Configuration pre Antrea v1.13](#configuration-pre-antrea-v113)
- [Theia Installation](#theia-installation)
- [Features](#features)
  - [Network Flow Visualization and Monitoring](#network-flow-visualization-and-monitoring)
  - [Multi-Cluster Monitoring](#multi-cluster-monitoring)
  - [NetworkPolicy Recommendation](#networkpolicy-recommendation)
  - [Throughput Anomaly Detection](#throughput-anomaly-detection)
- [Additional Information](#additional-information)
<!-- /toc -->

## Overview

Theia is a network observability and analytics platform for Kubernetes, built
on top of [Antrea](https://github.com/antrea-io/antrea). Theia consumes
[network flows exported by Antrea](https://github.com/antrea-io/antrea/blob/main/docs/network-flow-visibility.md)
to provide fine-grained visibility into the communication and NetworkPolicies
among Pods and Services in a Kubernetes cluster.

Theia supports network flow visualization and monitoring with Grafana, and can
recommend appropriate NetworkPolicy configuration to secure Kubernetes network
and applications. This guide describes how to install and get started with
Theia.

## Prerequisites

Theia requires that Antrea v2.6.0 or later is installed in the Kubernetes
cluster.

### Configuration

Please ensure the Flow Exporter feature of Antrea Agent is enabled in the
Antrea deployment manifest. You need to set both `featureGates.FlowExport`
flag and `flowExporter.enable` flag to true.

The `antrea-agent` ConfigMap should look like this:

```yaml
  antrea-agent.conf: |
    ...
    featureGates:
      ...
      FlowExporter: true
    flowExporter:
      ...
      enable: true
```

You can also deploy Antrea through Helm by running the following
commands.

```bash
helm repo add antrea https://charts.antrea.io
helm install antrea antrea/antrea -n kube-system --set featureGates.FlowExporter=true --set flowExporter.enable=true
```

This will install the latest available version of Antrea with the Flow Exporter
feature enabled. You can also install a specific version of Antrea (>= v1.8.0)
with `--version <TAG>`.

#### Configuration pre Antrea v1.13

Prior to the Antrea v1.13 release, the `flowExporter` option group in the
Antrea Agent configuration did not exist. To enable the Flow Exporter feature,
one simply needed to enable the feature gate, and the Flow Exporter related
configuration could be configured using the (now deprecated)
`flowCollectorAddr`, `flowPollInterval`, `activeFlowExportTimeout`,
`idleFlowExportTimeout` parameters.

The `antrea-agent` ConfigMap should look like this:

```yaml
  antrea-agent.conf: |
    ...
    featureGates:
      ...
      FlowExporter: true
```

When deploying Antrea (v1.8 - v1.12) through Helm, you can run the following
commands:

```bash
helm repo add antrea https://charts.antrea.io
helm install antrea antrea/antrea -n kube-system --set featureGates.FlowExporter=true --version <TAG>
```

For more information about Antrea Helm chart, please refer to
[Antrea Helm chart installation instructions](https://github.com/antrea-io/antrea/blob/main/docs/helm.md).

## Theia Installation

### Self-Hosted Installation (Recommended)

Theia v0.9.0+ supports fully self-hosted installation with all Docker images
hosted on GHCR and Grafana plugins embedded in a custom image. No external
downloads are required at runtime.

#### Prerequisites

1. Install Antrea with Flow Exporter enabled:

```bash
helm repo add antrea https://charts.antrea.io
helm install antrea antrea/antrea -n kube-system \
  --set featureGates.FlowExporter=true --set flowExporter.enable=true
```

2. Install the ClickHouse Operator CRDs:

```bash
kubectl apply -f https://raw.githubusercontent.com/Scoobed/theia/ghcr-image-migration/build/charts/theia/crds/clickhouse-operator-install-bundle.yaml
```

3. Install the Flow Aggregator:

```bash
helm install flow-aggregator antrea/flow-aggregator \
  --set clickHouse.enable=true,recordContents.podLabels=true \
  -n flow-aggregator --create-namespace
```

#### Install Theia

Install directly from the repository Helm chart:

```bash
helm install theia build/charts/theia -n flow-visibility --create-namespace
```

Or from the packaged chart:

```bash
helm repo add theia https://raw.githubusercontent.com/Scoobed/theia/ghcr-image-migration/charts
helm install theia theia/theia --version 0.9.0 -n flow-visibility --create-namespace
```

#### Docker Images

All images are hosted on `ghcr.io/scoobed/` with the `theia-` prefix:

| Image | Description |
|-------|-------------|
| `theia-grafana:v0.9.0` | Custom Grafana 13.0.2 with all plugins embedded |
| `theia-manager:v0.9.0` | Theia Manager API server |
| `theia-clickhouse-server:v0.9.0` | ClickHouse with schema management |
| `theia-clickhouse-monitor:v0.9.0` | ClickHouse storage monitor |
| `theia-spark-jobs:v0.9.0` | Spark jobs for policy recommendation |
| `theia-clickhouse-operator:0.27.0` | Altinity ClickHouse Operator |
| `theia-metrics-exporter:0.27.0` | ClickHouse metrics exporter |
| `theia-zookeeper:3.9.5` | ZooKeeper for ClickHouse replication |

The Grafana image includes all plugins pre-installed:
- `theia-grafana-sankey-plugin` v2.0.0 (d3-sankey visualization)
- `theia-grafana-chord-plugin` v2.0.0 (d3 chord diagram)
- `theia-grafana-dependency-plugin` v2.0.0 (mermaid dependency graph)
- `grafana-clickhouse-datasource` (latest compatible version)

No internet access is required at pod startup.

#### Building Images

```bash
# Build all Go-based images
make docker-images

# Build custom Grafana image (requires plugin dist/ directories to exist)
make theia-grafana

# Pull and retag upstream images
make pull-upstream-images CH_OPERATOR_TAG=0.27.0 CH_SERVER_TAG=25.8 GRAFANA_TAG=13.0.2 ZOOKEEPER_TAG=3.9.5
```

### Upstream Installation

For upstream installation from the Antrea Helm repo:

```bash
helm repo add antrea https://charts.antrea.io
helm repo update
```

To install Flow Aggregator:

```bash
helm install flow-aggregator antrea/flow-aggregator --set clickHouse.enable=true,recordContents.podLabels=true -n flow-aggregator --create-namespace
```

To install Theia with all features:

```bash
helm install theia antrea/theia --set sparkOperator.enable=true,theiaManager.enable=true -n flow-visibility --create-namespace
```

These will install the latest available versions of Flow Aggregator and Theia.
You can also install specific versions of Flow Aggregator (>= v1.8.0) and
Theia (>= v0.2.0) with `--version <TAG>`. Please ensure that you use the same
released version for the Flow Aggregator chart as for the Antrea chart.

### Upgrading an Existing Deployment

If you have an existing Flow Aggregator deployment and need to enable pod
labels (required for Theia's policy recommendation and label-based dashboards),
run:

```bash
helm upgrade flow-aggregator antrea/flow-aggregator \
  --reuse-values \
  --set recordContents.podLabels=true \
  -n flow-aggregator
kubectl -n flow-aggregator rollout restart deployment/flow-aggregator
```

Alternatively, use the helper script included in this repository:

```bash
./hack/configure-flow-aggregator-pod-labels.sh
```

### Verifying Pod Labels in ClickHouse

After enabling pod labels, verify that labels are being captured by querying
ClickHouse directly:

```bash
CH_POD=$(kubectl -n flow-visibility get pod -l app=clickhouse -o jsonpath='{.items[0].metadata.name}')
kubectl -n flow-visibility exec "$CH_POD" -c clickhouse -- clickhouse-client --query "\
SELECT sourcePodName, sourcePodLabels, destinationPodName, destinationPodLabels \
FROM flows \
WHERE sourcePodLabels != '' AND sourcePodLabels != '{}' \
ORDER BY timeInserted DESC LIMIT 5 FORMAT Pretty"
```

To check label capture coverage across all records:

```bash
kubectl -n flow-visibility exec "$CH_POD" -c clickhouse -- clickhouse-client --query "\
SELECT \
  count() as total_records, \
  countIf(sourcePodLabels != '' AND sourcePodLabels != '{}') as records_with_src_labels, \
  countIf(destinationPodLabels != '' AND destinationPodLabels != '{}') as records_with_dst_labels \
FROM flows FORMAT Pretty"
```

Or use the verify-only flag on the helper script:

```bash
./hack/configure-flow-aggregator-pod-labels.sh --verify-only
```

## Features

### Network Flow Visualization and Monitoring

Theia uses Grafana to visualize network flows in the Kubernetes cluster. After
the installation, you can run the following commands to get the Grafana Service
address:

```bash
NODE_NAME=$(kubectl get pod -l app=grafana -n flow-visibility -o jsonpath='{.items[0].spec.nodeName}')
NODE_IP=$(kubectl get nodes ${NODE_NAME} -o jsonpath='{.status.addresses[0].address}')
GRAFANA_NODEPORT=$(kubectl get svc grafana -n flow-visibility -o jsonpath='{.spec.ports[*].nodePort}')
echo "=== Grafana Service is listening on ${NODE_IP}:${GRAFANA_NODEPORT} ==="
```

You can access Grafana in your browser at: `http://[NodeIP]:[NodePort]`,
and log in with username: `admin` and password: `admin`. Navigate to the [Theia
dashboards](network-flow-visibility.md#grafana-dashboards) to view the network
flows in the cluster.

### Multi-Cluster Monitoring

Theia facilitates multi-cluster monitoring, allowing administrators to
simultaneously supervise network operations across Antrea clusters.
For guidance on exposing Theia across multiple clusters and enabling
secure connections, refer to the instructions in [clickhouse-ingress](clickhouse-ingress.md)

### NetworkPolicy Recommendation

Please follow the instructions in the [NetworkPolicy Recommendation](networkpolicy-recommendation.md)
user guide.

### Throughput Anomaly Detection

Please follow the instructions in the [Throughput Anomaly Detection](throughput-anomaly-detection.md)
user guide.

## Additional Information

Refer to Antrea documentation to learn more about
[Flow Exporter](https://github.com/antrea-io/antrea/blob/main/docs/network-flow-visibility.md#flow-exporter),
[Flow Aggregator](https://github.com/antrea-io/antrea/blob/main/docs/network-flow-visibility.md#flow-aggregator),
and their advanced configurations.

For more information about Grafana Flow Collector installation and
customization, please refer to Grafana Flow Collector [Deployment Steps](network-flow-visibility.md#deployment-steps),
and [Configuration](network-flow-visibility.md#configuration).

If you are interested in using Ingress to set up ClickHouse server, please refer
to [ClickHouse Ingress](clickhouse-ingress.md) for more information.
