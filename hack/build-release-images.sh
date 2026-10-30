#!/usr/bin/env bash
# Copyright 2026 Antrea Authors
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
source build/images/release.env
VERSION="${VERSION:-$(<VERSION)}"
TAG="${VERSION#v}"
REGISTRY="${DOCKER_REGISTRY:-ghcr.io/scoobed}"
MODE="${1:-build}"
if [[ "$MODE" != build && "$MODE" != push ]]; then
    printf 'Usage: %s [build|push]\n' "$0" >&2
    exit 1
fi
args=()
for key in GO_IMAGE STATIC_IMAGE CLICKHOUSE_IMAGE GRAFANA_IMAGE GRAFANA_BUILD_IMAGE \
           OPERATOR_IMAGE METRICS_IMAGE ZOOKEEPER_IMAGE INIT_IMAGE SYFT_IMAGE; do
    args+=(--build-arg "$key=${!key}")
done
args+=(--build-arg "VERSION=$TAG" --build-arg "VCS_REF=$(git rev-parse HEAD)")
components=(
    "manager:theia-manager"
    "monitor:theia-clickhouse-monitor"
    "clickhouse:theia-clickhouse-server"
    "grafana:theia-grafana"
    "operator:theia-clickhouse-operator"
    "metrics:theia-metrics-exporter"
    "zookeeper:theia-zookeeper"
    "init:theia-init"
)
for component in "${components[@]}"; do
    target="${component%%:*}"
    image="$REGISTRY/${component#*:}:$TAG"
    # Positional targets allow rebuilding a subset without changing release inputs.
    if [[ $# -gt 1 && " ${*:2} " != *" $target "* ]]; then
        continue
    fi
    output=(--load)
    if [[ "$MODE" == push ]]; then
        # Preserve the tested local image; attach full-image attestations separately
        # through the release workflow when building for multiple platforms.
        docker push "$image"
        continue
    fi
    docker buildx build --pull --platform "${PLATFORM:-linux/amd64}" \
        "${output[@]}" "${args[@]}" --target "$target" \
        -t "$image" -f build/images/Dockerfile.release .
done
