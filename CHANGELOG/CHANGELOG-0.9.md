# Changelog 0.9

## 0.9.4 - 2026-11-03

### Changed

- Rebuilt nine linux/amd64 images with refreshed, digest-pinned Docker Hardened
  Images (DHI) where compatible. Application versions remain Grafana 13.3.0,
  ClickHouse Operator/metrics exporter 0.27.4, ZooKeeper 3.9.6, and kubectl
  1.34.13. The hardened Go builder uses Go 1.27.3.
- Retained the explicitly approved upstream ClickHouse 26.10.3.7 exception.
  The evaluated DHI ClickHouse 26.10.2.103 image lacked the Brotli decoder
  security-fix marker. The release did not downgrade ClickHouse to that image.
  Immutable inputs are recorded in [release.env](../build/images/release.env).
- Retained the checksum-pinned Snappy Java 1.1.10.12 patch in ZooKeeper and
  embedded Grafana ClickHouse datasource plugin 4.23.4.
- Updated the chart, application version, and all enabled release image
  references to 0.9.4, preserving existing 0.9.3 registry artifacts.
- Left Spark jobs and Spark Operator unchanged and excluded from the rebuild.
  The current integration targets Spark 3.x; the evaluated DHI catalog offers
  Spark 4.x, requiring a separately validated migration.

### Fixed

- Schema migrations use semantic version parsing and ignore build metadata:
  `0.9.3+b36edc5f0ba6` has the same schema identity as `0.9.3`.
- Helm removes build metadata from `THEIA_VERSION`, so existing migration
  binaries receive a numeric release version.
- ClickHouse datasource provisioning uses `host`, native protocol, the
  configured TCP port, database `default`, and UID `PDEE91DDB90597936`, matching
  the dashboards. Credentials remain Secret-backed environment references.
- Grafana's pod template includes a datasource-configuration checksum, causing
  configuration changes to trigger a rollout on Helm upgrade.
- Grafana supports default UID/GID 65532:65532 and explicit 101:101 with
  correctly owned volumes. Image data/log directories use owner 101, group
  65532, and mode `0770`; root-owned `/tmp` uses sticky mode `1777` for backend
  plugin IPC. The signed ClickHouse plugin does not need an unsigned bypass.
- Image builds reject missing/empty custom plugin manifests/modules and a
  non-executable architecture-specific ClickHouse backend. Embedded plugins
  reside in `/opt/grafana/plugins`, not `/var/lib/grafana/plugins`.
- Grafana uses one replica and a `Recreate` strategy, preventing SQLite/Bleve
  index locks from concurrent processes sharing its PVC during upgrades.

### Published artifacts

All images are private, tagged `0.9.4`, and built for **linux/amd64**. Each has
SPDX SBOM and SLSA provenance attestations. The publications are OCI-compatible;
strict legacy Docker-schema-2-only conversion was not part of this release.

| Image | Published digest |
|---|---|
| `ghcr.io/scoobed/theia-manager:0.9.4` | `sha256:4f9dc5117073b1082742c0e13d96e2745f40569125c5c4384232510189ce890e` |
| `ghcr.io/scoobed/theia-clickhouse-monitor:0.9.4` | `sha256:3a6d12669dd3ab4e05f2dfb7ecb43c1a5246f2b208ddda5b9b4e18db495cc90b` |
| `ghcr.io/scoobed/theia-clickhouse-server:0.9.4` | `sha256:39f67f58bb190f30528c0c9a98816ea3c2873ee5089ded46465d1aa91ddd726b` |
| `ghcr.io/scoobed/theia-grafana:0.9.4` | `sha256:3f8236ba53358911cb6a104dff658bd6ee6d4756dc977ffd5f6e9facf71c11ab` |
| `ghcr.io/scoobed/theia-clickhouse-operator:0.9.4` | `sha256:2035c3fd943de29b276885c22e3f2e90399990e1cd73b332bc432cc575853ec8` |
| `ghcr.io/scoobed/theia-metrics-exporter:0.9.4` | `sha256:c8b5ef51ab5bc3ff438bc9deab9ab1c752d85e613d435b30aa65e8c1a23fae61` |
| `ghcr.io/scoobed/theia-zookeeper:0.9.4` | `sha256:990ef0aafd106a0ea941674eae29831b9d5465c4ac2eabd0bcf7ba5dfed5e033` |
| `ghcr.io/scoobed/theia-init:0.9.4` | `sha256:977a569896f3a8c9c865959454099cb7ac699fccbec0741c5867563f1e67b44e` |
| `ghcr.io/scoobed/theia-kubectl:0.9.4` | `sha256:fc7efb2865b50a8269179e2562d4f1451f4802a6065b899910a719855aae26f3` |

Helm chart:

- Reference: `oci://ghcr.io/scoobed/charts/theia`
- Chart/application version: `0.9.4`
- Digest: `sha256:5825cd3d7150ef33b298ff0dd3352a02666ed7d35fc9a76befe6e106ef7f7887`

### Security findings and limitations

- The 2026-11-03 scan snapshot reported no CISA KEV matches and no critical
  findings across the nine images.
- **Five high-severity findings remain in ZooKeeper.** No other image had high
  findings in that snapshot. Medium, low, and unknown findings remain; hardened
  bases do not eliminate application dependency vulnerabilities.
- Recheck current findings with `python3 hack/scan-release-images.py`. The
  script blocks on reported KEV matches; review embedded libraries, vendor
  advisories, and VEX information separately.
- Required Theia/ClickHouse plugins are embedded and backend operation was
  tested without external network access. Full browser-level rendering and a
  completely air-gapped UI were not certified. Optional Grafana catalog/update
  requests and external logo references need separate offline configuration or
  asset changes.

### Upgrade notes

1. Back up data and retain existing storage/application configuration. Image
   permissions do not override mounted-volume ownership; root-squashed NFS
   storage may need external preparation.
2. Follow the [private GHCR guide](../README.md#private-ghcr-image-pulls).
   Image-pull Secrets are needed in both the release and operator namespaces;
   Helm registry authentication is separate.
3. Remove stale image-tag overrides from saved values. `--reuse-values` can
   retain 0.9.3 or local test-image references despite new chart defaults.
   Render and review the merged image references before applying.
4. Expect brief Grafana downtime during `Recreate` upgrades. When changing UID,
   stop old writers before volume ownership migration and retain the
   init-chown-data helper or prepare volume ownership externally.
5. `THEIA_VERSION` is the Theia schema target (`0.9.4` for this release), not the
   ClickHouse server version `26.10.3.7`.

Prepare `deployment-values.yaml` with retained storage/credentials and current
image settings, and `values-ghcr.yaml` with pull-Secret references, then run:

```bash
helm registry login ghcr.io
helm upgrade --install theia oci://ghcr.io/scoobed/charts/theia \
  --version 0.9.4 --namespace flow-visibility --create-namespace \
  --values deployment-values.yaml --values values-ghcr.yaml \
  --wait --timeout 15m
```

### Validation performed

- Go unit/race tests, new-code lint, Helm lint, and rendering regressions
  passed, including datasource UID binding, rollout checksums, image tags,
  storage/TLS variants, and build-metadata normalization.
- Image permission checks passed as both 101:101 and 65532:65532. The UID 101
  backend temporary-file failure was reproduced before the fix and resolved.
- The image set and the exact chart pulled back from GHCR deployed in an
  isolated Kubernetes 1.34.3 cluster. All four Grafana plugins registered,
  ClickHouse's plugin signature was valid, datasource health returned HTTP
  200, authenticated SQL returned `1`, and manager readiness passed.
- The rebuilt migrator accepted `0.9.4+release.verify`. Schema version,
  flow-row count, and existing PVC identities were preserved.
- Published binaries/plugin assets matched tested files; the downloaded chart
  matched the uploaded archive. Recorded 0.9.3 digests stayed unchanged.
- The active `docker-desktop` installation was not upgraded during validation.
