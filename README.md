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
| Go (for building) | >= 1.27.1 (release builder: 1.27.3) |
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

### 2. ClickHouse Operator

The Theia chart installs the latest Altinity operator chart dependency (0.27.4).
Do not install a second cluster-wide operator separately.

### 3. Install Flow Aggregator

```bash
helm install flow-aggregator antrea/flow-aggregator \
  --set clickHouse.enable=true,recordContents.podLabels=true \
  -n flow-aggregator --create-namespace
```

### 4. Install Theia

First complete [private GHCR image-pull setup](#private-ghcr-image-pulls) and save
the example Helm values as `values-ghcr.yaml`.

```bash
helm install theia build/charts/theia -n flow-visibility --create-namespace \
  --values values-ghcr.yaml --wait --timeout 15m
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
| `theia-grafana:0.9.4` | Hardened Grafana 13.3.0 with embedded plugins |
| `theia-manager:0.9.4` | Theia Manager on a DHI static runtime |
| `theia-clickhouse-server:0.9.4` | Upstream ClickHouse 26.10.3.7 with schema management |
| `theia-clickhouse-monitor:0.9.4` | ClickHouse monitor on a DHI static runtime |
| `theia-clickhouse-operator:0.9.4` | Hardened Altinity ClickHouse Operator 0.27.4 |
| `theia-metrics-exporter:0.9.4` | Hardened ClickHouse metrics exporter 0.27.4 |
| `theia-zookeeper:0.9.4` | Hardened ZooKeeper 3.9.6 |
| `theia-init:0.9.4` | Minimal ownership helper on a DHI static runtime |
| `theia-kubectl:0.9.4` | Hardened kubectl for operator CRD hooks |

Release inputs are pinned by digest in `build/images/release.env`.
ClickHouse is an explicit upstream exception: the available DHI 26.10.2 image
does not contain the new decoder marker from the Brotli CVE-2026-111497 fix,
while upstream 26.10.3.7 does. Hardened bases do not eliminate application
vulnerabilities; scan final images and review embedded libraries as well.
Release `0.9.4` uses new image and chart tags, preserving existing `0.9.3`
artifacts. The earlier ClickHouse `0.9.3` tag was explicitly replaced with
26.10.3.7 before this release. A node
that cached the previous image under `IfNotPresent` will not automatically
download its replacement. For any later rollout, pin the verified image digest
or explicitly pull the replacement (for example, use `clickhouse.image.pullPolicy=Always`)
before recreating Pods. Restarting a Pod alone does not invalidate its image cache.
Spark jobs and Spark Operator are not rebuilt or upgraded in this release:
the DHI catalog only offers Spark 4.x, incompatible with the current Spark 3.x
integration without a separately validated migration.
Grafana and ZooKeeper now use UID/GID 65532. Back up existing persistent data
and validate volume ownership before upgrading a running installation.
The manager runs non-root and logs to stderr with writable ephemeral runtime directories.
The Grafana image keeps UID/GID 65532 as its default and also supports running
as `101:101` with fresh image-owned data directories. Plugins are installed
under `/opt/grafana/plugins`, with readable assets and executable backend
binaries; `/var/lib/grafana/plugins` is not the configured plugin path.
`/var/lib/grafana` and `/var/log/grafana` are writable by UID 101 and group
65532. `/tmp` uses standard root-owned sticky `1777` permissions because
Grafana's backend plugins create temporary IPC files there.
For a UID 101 Helm deployment, set `grafana.securityContext.runAsUser`,
`runAsGroup`, and `fsGroup` to 101 and retain `grafana.initChownData.enable=true`.
Existing mounted volumes must be owned appropriately; image permissions do
not override volume ownership, and root-squashed NFS storage may need to be
prepared externally. When changing UID on an existing SQLite PVC, stop the
old Grafana pod before ownership migration so a rolling update does not leave
old and new UIDs writing the same volume; restore the desired replica count
afterward. Do not add the signed ClickHouse plugin to the unsigned
allowlist to work around a temporary-file permission failure.

The chart deploys one Grafana replica with a `Recreate` update strategy.
Upgrades briefly stop Grafana before starting its replacement, preventing
SQLite/Bleve lock failures from two processes sharing the same data PVC.

Check a locally rebuilt image with
`python3 hack/test-grafana-image-permissions.py ghcr.io/scoobed/theia-grafana:0.9.4`.

### Private GHCR image pulls

The `ghcr.io/scoobed` images and OCI chart are private. Use a GitHub account
with access to the packages and a personal access token (classic) with
`read:packages` permission. Authorize the token for organization SSO if required.
Use read-only credentials for deployments, not the write-enabled publishing token.

Registry authentication has two separate scopes:

- **Kubernetes image pulls:** a `kubernetes.io/dockerconfigjson` Secret must exist
  in each namespace that runs a Pod. By default, create `ghcr-pull` in
  `flow-visibility` for Theia, Grafana, ClickHouse, ZooKeeper, and schema hooks,
  and in `kube-system` for the operator, exporter, and CRD-install hook.
- **Helm OCI chart pulls:** authenticate the local Helm client separately.
  `helm registry login` does not create Kubernetes image-pull Secrets.

#### Create the namespace-scoped Secrets

Verify the intended cluster with `kubectl config current-context` first.
The following Bash example prompts for the token without echoing it, uses a
temporary Docker configuration containing only GHCR credentials, and sends the
Secret manifests directly to Kubernetes without printing them. It does not
copy your normal Docker configuration or DHI credentials.

```bash
(
  set -eo pipefail
  umask 077
  KUBE_CONTEXT=$(kubectl config current-context)
  RELEASE_NAMESPACE=flow-visibility
  OPERATOR_NAMESPACE=kube-system
  DOCKER_CONFIG=$(mktemp -d)
  export DOCKER_CONFIG
  trap 'unset GHCR_TOKEN; rm -f -- "$DOCKER_CONFIG/config.json"; rmdir -- "$DOCKER_CONFIG"' EXIT
  # A registry entry prevents automatic selection of a host credential helper.
  printf '{"auths":{"ghcr.io":{}}}\n' > "$DOCKER_CONFIG/config.json"

  read -r -p 'GitHub username: ' GHCR_USER
  read -r -s -p 'GitHub token with read:packages: ' GHCR_TOKEN
  printf '\n'
  printf '%s' "$GHCR_TOKEN" |
    docker login ghcr.io --username "$GHCR_USER" --password-stdin
  unset GHCR_TOKEN

  for namespace in "$RELEASE_NAMESPACE" "$OPERATOR_NAMESPACE"; do
    kubectl --context="$KUBE_CONTEXT" create namespace "$namespace" \
      --dry-run=client -o yaml |
      kubectl --context="$KUBE_CONTEXT" apply -f -
    kubectl --context="$KUBE_CONTEXT" -n "$namespace" create secret generic ghcr-pull \
      --type=kubernetes.io/dockerconfigjson \
      --from-file=".dockerconfigjson=$DOCKER_CONFIG/config.json" \
      --dry-run=client -o yaml |
      kubectl --context="$KUBE_CONTEXT" -n "$namespace" apply -f -
  done
)
```

If you change the release namespace or `altinity-clickhouse-operator.namespaceOverride`,
change the namespaces above as well. An empty `namespaceOverride` places the
operator in the release namespace; only one Secret is then needed.
Do not commit tokens, Docker credential files, or generated Secret manifests.

#### Configure Helm values

Save this configuration as `values-ghcr.yaml`. It contains Secret names only
and is safe to keep with your deployment configuration. All three lists are
required because the operator subchart and its CRD hook have separate settings:

```yaml
imagePullSecrets:
  - name: ghcr-pull
altinity-clickhouse-operator:
  imagePullSecrets:
    - name: ghcr-pull
  crdHook:
    imagePullSecrets:
      - name: ghcr-pull
```

#### Authenticate Helm and deploy

Authenticate interactively using the same read-only token as the password:

```bash
helm registry login ghcr.io --username scoobed
```

Use your own authorized GitHub username if different. Install from GHCR with
the Secret references and a timeout that allows initial schema reconciliation:

```bash
helm upgrade --install theia oci://ghcr.io/scoobed/charts/theia \
  --version 0.9.4 --namespace flow-visibility --create-namespace \
  --values values-ghcr.yaml --wait --timeout 15m
```

For an existing installation, back up persistent data and include your existing
storage and application values files too. Setting pull Secrets does not replace
the need to preserve those values during an upgrade.

#### Verify access and rotate credentials

Check Secret metadata and Pod events without printing credential data:

```bash
kubectl -n flow-visibility get secret ghcr-pull
kubectl -n kube-system get secret ghcr-pull
kubectl -n flow-visibility get pods
kubectl -n kube-system get pods -l app.kubernetes.io/instance=theia
kubectl -n flow-visibility get events --field-selector=type=Warning
kubectl -n kube-system get events --field-selector=type=Warning
```

`FailedToRetrieveImagePullSecret` usually means a missing Secret or wrong
namespace/name. For `ErrImagePull` or `ImagePullBackOff`, inspect the Pod events:
`unauthorized` or `denied` indicates expired credentials, missing `read:packages`
permission, or missing package/SSO access. A missing image tag is a separate
problem. Successfully pulling the OCI chart does not prove that kubelets can
pull its images.

To rotate credentials, rerun the Secret-creation example with the new token in
every affected namespace and re-authenticate Helm. Verify a subsequent image
pull before revoking the old token; already-running containers do not test
whether replacement credentials work.

### Grafana plugins

The required Theia and ClickHouse plugins are embedded in the Grafana image;
using these plugins does not require runtime installation:

- `theia-grafana-sankey-plugin` v2.0.0 — Sankey flow diagrams (d3-sankey)
- `theia-grafana-chord-plugin` v2.0.0 — Chord network diagrams (d3)
- `theia-grafana-dependency-plugin` v2.0.0 — Dependency graphs (mermaid)
- `grafana-clickhouse-datasource` — ClickHouse data source

This does not disable Grafana's optional online catalog/update requests, and
some logo references remain external. See the
[0.9.4 release notes](CHANGELOG/CHANGELOG-0.9.md) for validation scope, known
security findings, and offline-operation limitations.

## Building

### Go Images

```bash
# Authenticate to Docker Hardened Images and build all nine release images
docker login dhi.io
make docker-images

# Build individual images
make clickhouse-monitor
make theia-manager
make clickhouse-server
# Validate rendered images, then scan final images against CISA KEV
python3 hack/test-release-chart.py
python3 hack/scan-release-images.py

# After runtime validation, use an attestation-capable publisher.
# Creating this builder does not switch your active Docker builder.
docker buildx create --name theia-publisher --driver docker-container --bootstrap
BUILDX_BUILDER=theia-publisher make release-images-push
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

### Legacy Upstream Images

The following legacy targets do not use the hardened release configuration.
Use `make release-images` for the current release instead.

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

- [0.9.4 Release Notes](CHANGELOG/CHANGELOG-0.9.md)
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
