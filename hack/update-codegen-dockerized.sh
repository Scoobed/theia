#!/usr/bin/env bash

# Copyright 2022 Antrea Authors
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

set -o errexit
set -o nounset
set -o pipefail
set -o xtrace

GOPATH=`go env GOPATH`
THEIA_PKG="antrea.io/theia"

function reset_year_change {
  set +x
  echo "=== Start resetting changes introduced by YEAR ==="
  # The call to 'tac' ensures that we cannot have concurrent git processes, by
  # waiting for the call to 'git diff  --numstat' to complete before iterating
  # over the files and calling 'git diff ${file}'.
  if git diff --numstat > /dev/null 2>&1; then
    git diff --numstat | awk '$1 == "1" && $2 == "1" {print $3}' | tac | while read file; do
      if [[ -n "${file}" ]] && git diff "${file}" 2>/dev/null | grep -q "\-// Copyright .*Antrea Authors"; then
        git checkout HEAD -- "${file}" 2>/dev/null || true
        echo "=== ${file} is reset ==="
      fi
    done
  fi
}

# Generate clientset and apis code with K8s codegen tools.
$GOPATH/bin/client-gen \
  --clientset-name versioned \
  --input-base "${THEIA_PKG}/pkg/apis/" \
  --input "crd/v1alpha1" \
  --output-dir "pkg/client/clientset" \
  --output-pkg "${THEIA_PKG}/pkg/client/clientset" \
  --go-header-file hack/boilerplate/license_header.go.txt

# Generate listers with K8s codegen tools.
# Note: In K8s 1.35+, lister-gen takes packages as positional arguments
$GOPATH/bin/lister-gen \
  --output-dir "pkg/client/listers" \
  --output-pkg "${THEIA_PKG}/pkg/client/listers" \
  --go-header-file hack/boilerplate/license_header.go.txt \
  "${THEIA_PKG}/pkg/apis/crd/v1alpha1"

# Generate informers with K8s codegen tools.
# Note: In K8s 1.35+, informer-gen takes packages as positional arguments
$GOPATH/bin/informer-gen \
  --versioned-clientset-package "${THEIA_PKG}/pkg/client/clientset/versioned" \
  --listers-package "${THEIA_PKG}/pkg/client/listers" \
  --output-dir "pkg/client/informers" \
  --output-pkg "${THEIA_PKG}/pkg/client/informers" \
  --go-header-file hack/boilerplate/license_header.go.txt \
  "${THEIA_PKG}/pkg/apis/crd/v1alpha1"

# Generate OpenAPI definitions
$GOPATH/bin/openapi-gen \
  --output-dir "pkg/apiserver/openapi" \
  --output-pkg "${THEIA_PKG}/pkg/apiserver/openapi" \
  --output-file zz_generated.openapi.go \
  --go-header-file hack/boilerplate/license_header.go.txt \
  "${THEIA_PKG}/pkg/apis/intelligence/v1alpha1" \
  "${THEIA_PKG}/pkg/apis/stats/v1alpha1" \
  "${THEIA_PKG}/pkg/apis/system/v1alpha1" \
  "k8s.io/apimachinery/pkg/apis/meta/v1" \
  "k8s.io/apimachinery/pkg/runtime" \
  "k8s.io/apimachinery/pkg/version"

# Generate deepcopy code
$GOPATH/bin/deepcopy-gen \
  --output-file zz_generated.deepcopy.go \
  --go-header-file hack/boilerplate/license_header.go.txt \
  "${THEIA_PKG}/pkg/apis/intelligence/v1alpha1" \
  "${THEIA_PKG}/pkg/apis/system/v1alpha1" \
  "${THEIA_PKG}/pkg/apis/crd/v1alpha1" \
  "${THEIA_PKG}/pkg/apis/stats/v1alpha1"

reset_year_change
