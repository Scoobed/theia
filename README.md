# Theia

Theia is a network observability and analytics platform for Kubernetes. It is
built on top of [Antrea](https://github.com/antrea-io/antrea), and consumes
[network flows exported by Antrea](https://github.com/antrea-io/antrea/blob/main/docs/network-flow-visibility.md)
to provide fine-grained visibility into the communication and NetworkPolicies
among Pods and Services in a Kubernetes cluster.

## Requirements

| Component | Version |
|---|---|
| Kubernetes | >= 1.16 |
| Antrea | >= 2.6.0 |
| Go (for building) | 1.26.4 |
| Node.js (for Grafana plugins) | >= 18 |
| Docker | >= 24.0 |
| Helm | >= 3.0 |

## Quick Start

### 1. Install Antrea with Flow Exporter

```bash
helm repo add antrea https://charts.antrea.io
helm install antrea antrea/antrea -n kube-system \
  --set featureGates.FlowExporter=true --set flowExporter.enable=true
```

### 2. Install ClickHouse Operator

```bash
kubectl apply -f build/charts/theia/crds/clickhouse-operator-install-bundle.yaml
```

### 3. Install Flow Aggregator

```bash
helm install flow-aggregator antrea/flow-aggregator \
  --set clickHouse.enable=true,recordContents.podLabels=true \
  -n flow-aggregator --create-namespace
```

### 4. Install Theia

```bash
helm install theia build/charts/theia -n flow-visibility --create-namespace
```

### 5. Access Grafana

```bash
kubectl port-forward svc/grafana 3000:3000 -n flow-visibility
```

Open `http://localhost:3000` (default credentials: admin/admin).

## Docker Images

All images are hosted on `ghcr.io/scoobed/` with the `theia-` prefix:

| Image | Description |
|---|---|
| `theia-grafana:v0.9.0` | Custom Grafana 13.0.2 with all plugins embedded |
| `theia-manager:v0.9.0` | Theia Manager API server |
| `theia-clickhouse-server:v0.9.0` | ClickHouse with schema management |
| `theia-clickhouse-monitor:v0.9.0` | ClickHouse storage monitor |
| `theia-spark-jobs:v0.9.0` | Spark jobs for policy recommendation |
| `theia-clickhouse-operator:0.27.0` | Altinity ClickHouse Operator |
| `theia-metrics-exporter:0.27.0` | ClickHouse metrics exporter |
| `theia-zookeeper:3.9.5` | ZooKeeper for ClickHouse replication |

The Grafana image is fully immutable — all plugins are pre-installed and no
internet access is required at pod startup:

- `theia-grafana-sankey-plugin` v2.0.0 — Sankey flow diagrams (d3-sankey)
- `theia-grafana-chord-plugin` v2.0.0 — Chord network diagrams (d3)
- `theia-grafana-dependency-plugin` v2.0.0 — Dependency graphs (mermaid)
- `grafana-clickhouse-datasource` — ClickHouse data source

## Building

### Go Images

```bash
# Build all Go-based Docker images
make docker-images

# Build individual images
make clickhouse-monitor
make theia-manager
make clickhouse-server
make spark-jobs
```

### Grafana Image

The custom Grafana image requires the plugin `dist/` directories to exist
(run `yarn build` in each plugin directory first):

```bash
# Build Grafana plugins
for plugin in grafana-sankey-plugin grafana-chord-plugin grafana-dependency-plugin; do
  yarn --cwd plugins/grafana-custom-plugins/${plugin} install
  yarn --cwd plugins/grafana-custom-plugins/${plugin} build
done

# Build the custom Grafana image
make theia-grafana
```

### Upstream Images

Pull and retag upstream images to `ghcr.io/scoobed/theia-*`:

```bash
make pull-upstream-images \
  CH_OPERATOR_TAG=0.27.0 \
  CH_SERVER_TAG=25.8 \
  GRAFANA_TAG=13.0.2 \
  ZOOKEEPER_TAG=3.9.5
```

## Configuration

See `build/charts/theia/values.yaml` for all configurable Helm values.
Key options:

| Value | Default | Description |
|---|---|---|
| `clickhouse.storage.size` | `8Gi` | ClickHouse data volume size |
| `clickhouse.ttl` | `12 HOUR` | Flow record retention period |
| `clickhouse.cluster.shards` | `1` | Number of ClickHouse shards |
| `clickhouse.cluster.replicas` | `1` | Replicas per shard |
| `grafana.service.type` | `NodePort` | Grafana service type |
| `theiaManager.enable` | `true` | Enable Theia Manager API |
| `sparkOperator.enable` | `false` | Enable Spark Operator |

## Architecture

```
Antrea Agent (Flow Exporter)
        │
        ▼
  Flow Aggregator ──► ClickHouse ◄── Theia Manager
                          │
                          ▼
                       Grafana (dashboards)
```

1. **Antrea Flow Exporter** captures network flows from conntrack
2. **Flow Aggregator** correlates and stores flows in ClickHouse
3. **ClickHouse** stores flow records with materialized views for dashboards
4. **Grafana** visualizes flows via 8 pre-built dashboards
5. **Theia Manager** provides API for policy recommendation and anomaly detection

## Documentation

- [Getting Started Guide](docs/getting-started.md)
- [Network Flow Visibility](docs/network-flow-visibility.md)
- [NetworkPolicy Recommendation](docs/networkpolicy-recommendation.md)
- [Throughput Anomaly Detection](docs/throughput-anomaly-detection.md)
- [ClickHouse Ingress Configuration](docs/clickhouse-ingress.md)

## Contributing

The Antrea community welcomes new contributors. We are waiting for your PRs!

* Before contributing, please get familiar with our
[Code of Conduct](CODE_OF_CONDUCT.md).
* Check out the Antrea [Contributor Guide](CONTRIBUTING.md) for information
about setting up your development environment and our contribution workflow.
* Learn about Antrea's [Architecture and Design](https://github.com/antrea-io/antrea/blob/main/docs/design/architecture.md).
Your feedback is more than welcome!
* Check out [Open Issues](https://github.com/antrea-io/theia/issues).
* Join the Antrea [community](#community) and ask us any question you may have.

## Community

Please refer to the [Antrea community](https://github.com/antrea-io/antrea/blob/main/README.md#community)
information.

## License

Theia is licensed under the [Apache License, version 2.0](LICENSE)
