#!/usr/bin/env bash

# Copyright 2022 Antrea Authors.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

set -e

THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

source $THIS_DIR/create_table.sh
/clickhouse-schema-management

# Retry createTable up to 5 times with 10s delay.
# The distributed tables (flows, recommendations, etc.) depend on the
# ClickHouse cluster macros ({cluster}, {shard}, {replica}) which may
# not be available immediately when the operator is still configuring.
MAX_RETRIES=5
RETRY_DELAY=10
for i in $(seq 1 $MAX_RETRIES); do
  if createTable; then
    echo "Tables created successfully on attempt $i"
    break
  fi
  if [ $i -eq $MAX_RETRIES ]; then
    echo "Failed to create tables after $MAX_RETRIES attempts"
    exit 1
  fi
  echo "Table creation attempt $i failed, retrying in ${RETRY_DELAY}s..."
  sleep $RETRY_DELAY
done
