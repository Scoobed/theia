#!/usr/bin/env bash
# Copyright 2025 Antrea Authors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# configure-flow-aggregator-pod-labels.sh
#
# Enables podLabels in the Flow Aggregator and verifies that labels are
# appearing in the ClickHouse flows table.
#
# Usage: ./hack/configure-flow-aggregator-pod-labels.sh [--verify-only]

set -euo pipefail

FA_NAMESPACE="flow-aggregator"
CH_NAMESPACE="flow-visibility"
CH_SERVICE="clickhouse-clickhouse"

VERIFY_ONLY=false
if [[ "${1:-}" == "--verify-only" ]]; then
    VERIFY_ONLY=true
fi

# ── Helpers ────────────────────────────────────────────────────────────────────

die() { echo "ERROR: $*" >&2; exit 1; }

require_cmd() {
    command -v "$1" &>/dev/null || die "'$1' is required but not found"
}

# ── Pre-flight checks ──────────────────────────────────────────────────────────

require_cmd kubectl

echo "==> Checking cluster connectivity..."
kubectl cluster-info --request-timeout=5s >/dev/null 2>&1 || \
    die "Cannot reach Kubernetes cluster. Is KUBECONFIG set correctly?"

kubectl get namespace "$FA_NAMESPACE" &>/dev/null || \
    die "Namespace '$FA_NAMESPACE' not found. Is the Flow Aggregator installed?"

kubectl get namespace "$CH_NAMESPACE" &>/dev/null || \
    die "Namespace '$CH_NAMESPACE' not found. Is Theia installed?"

# ── Find the Flow Aggregator ConfigMap ────────────────────────────────────────

FA_CM=$(kubectl -n "$FA_NAMESPACE" get configmap -o name \
    --field-selector metadata.name=flow-aggregator-configmap 2>/dev/null | head -1)
if [[ -z "$FA_CM" ]]; then
    # Fall back: find any configmap whose data contains flow-aggregator.conf
    FA_CM=$(kubectl -n "$FA_NAMESPACE" get configmap -o json | \
        python3 -c "
import sys, json
items = json.load(sys.stdin)['items']
for item in items:
    if 'flow-aggregator.conf' in item.get('data', {}):
        print('configmap/' + item['metadata']['name'])
        break
" 2>/dev/null)
fi
[[ -n "$FA_CM" ]] || die "Cannot find Flow Aggregator ConfigMap in namespace '$FA_NAMESPACE'"

echo "==> Found ConfigMap: $FA_CM"

# ── Check current podLabels setting ───────────────────────────────────────────

CURRENT_CONF=$(kubectl -n "$FA_NAMESPACE" get "$FA_CM" \
    -o jsonpath='{.data.flow-aggregator\.conf}')
POD_LABELS_CURRENT=$(echo "$CURRENT_CONF" | grep -A5 "recordContents:" | \
    grep "podLabels:" | awk '{print $2}' || echo "not set")

echo "==> Current podLabels setting: ${POD_LABELS_CURRENT:-not set}"

if [[ "$VERIFY_ONLY" == "true" ]]; then
    echo "==> --verify-only: skipping ConfigMap update"
else
    if echo "$CURRENT_CONF" | grep -q "podLabels: true"; then
        echo "==> podLabels is already enabled — no update needed"
    else
        echo "==> Enabling podLabels via Helm upgrade..."

        # Prefer Helm upgrade if available; fall back to kubectl patch
        if command -v helm &>/dev/null; then
            HELM_RELEASE=$(helm -n "$FA_NAMESPACE" list -q | grep "flow-aggregator" | head -1)
            if [[ -n "$HELM_RELEASE" ]]; then
                helm upgrade "$HELM_RELEASE" antrea/flow-aggregator \
                    --reuse-values \
                    --set "recordContents.podLabels=true" \
                    -n "$FA_NAMESPACE"
                echo "==> Helm upgrade complete"
            else
                echo "==> No Helm release found, patching ConfigMap directly..."
                _patch_configmap
            fi
        else
            _patch_configmap
        fi

        echo "==> Restarting Flow Aggregator pod..."
        kubectl -n "$FA_NAMESPACE" rollout restart deployment/flow-aggregator
        kubectl -n "$FA_NAMESPACE" rollout status deployment/flow-aggregator --timeout=120s
        echo "==> Flow Aggregator restarted"
    fi
fi

# ── Verify in ClickHouse ───────────────────────────────────────────────────────

echo ""
echo "==> Waiting up to 60s for a flow record with non-empty pod labels..."

CH_POD=$(kubectl -n "$CH_NAMESPACE" get pod \
    -l app=clickhouse \
    -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
[[ -n "$CH_POD" ]] || die "Cannot find ClickHouse pod in namespace '$CH_NAMESPACE'"

VERIFY_CMD='clickhouse-client --query "
SELECT
    sourcePodName,
    sourcePodLabels,
    destinationPodName,
    destinationPodLabels
FROM flows
WHERE sourcePodLabels != '\'''\'' AND sourcePodLabels != '\''{}'\''
ORDER BY timeInserted DESC
LIMIT 5 FORMAT Pretty"'

RESULT=""
for i in $(seq 1 12); do
    RESULT=$(kubectl -n "$CH_NAMESPACE" exec "$CH_POD" -c clickhouse -- \
        bash -c "$VERIFY_CMD" 2>/dev/null || true)
    if [[ -n "$RESULT" ]]; then
        break
    fi
    echo "    Attempt $i/12: no labelled records yet, waiting 5s..."
    sleep 5
done

echo ""
if [[ -n "$RESULT" ]]; then
    echo "==> SUCCESS: Pod labels are being captured in ClickHouse:"
    echo "$RESULT"
else
    echo "==> WARNING: No flow records with pod labels found yet."
    echo "    This can happen if:"
    echo "    - The cluster has no active pod-to-pod traffic"
    echo "    - The Flow Aggregator hasn't exported records yet (default interval: 8s)"
    echo "    - Pod labels were empty on the source/destination pods"
    echo ""
    echo "    Check current label capture status:"
    kubectl -n "$CH_NAMESPACE" exec "$CH_POD" -c clickhouse -- \
        bash -c 'clickhouse-client --query "
SELECT
    count() as total_records,
    countIf(sourcePodLabels != '\'''\'' AND sourcePodLabels != '\''{}'\'' ) as records_with_src_labels,
    countIf(destinationPodLabels != '\'''\'' AND destinationPodLabels != '\''{}'\'' ) as records_with_dst_labels
FROM flows FORMAT Pretty"' 2>/dev/null || true
fi

_patch_configmap() {
    # Read current config, inject/update podLabels under recordContents
    PATCHED=$(echo "$CURRENT_CONF" | python3 -c "
import sys
conf = sys.stdin.read()
if 'recordContents:' in conf:
    if 'podLabels:' in conf:
        import re
        conf = re.sub(r'(\s*podLabels:\s*).*', r'\1true', conf)
    else:
        conf = conf.replace('recordContents:', 'recordContents:\n  podLabels: true')
else:
    conf += '\nrecordContents:\n  podLabels: true\n'
print(conf, end='')
")
    kubectl -n "$FA_NAMESPACE" patch "$FA_CM" \
        --type merge \
        -p "{\"data\":{\"flow-aggregator.conf\":$(echo "$PATCHED" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))")}}"
    echo "==> ConfigMap patched"
}
