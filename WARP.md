# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Overview

Theia is a network observability and analytics platform for Kubernetes built on top of Antrea. It consumes network flows exported by Antrea to provide visibility into Pod/Service communication and NetworkPolicies. The project is written in Go 1.21 with some Python components for Spark jobs.

## Common Development Commands

### Building

```bash
# Build all theia CLI binaries for all platforms (darwin, linux, windows)
make theia

# Build theia manager binary (Linux only)
make theia-manager-bin

# Build clickhouse monitor plugin
make clickhouse-monitor-plugin

# Build all plugins
make bin
```

### Testing

```bash
# Run all unit tests (Linux only)
make test-unit

# Run tests in Docker (works on any platform)
make docker-test-unit

# Run a single test file
go test antrea.io/theia/pkg/theia/commands -run TestPolicyRecommendationRun

# Run a specific test function
go test -race antrea.io/theia/pkg/controller/networkpolicyrecommendation -run TestAddNPRecommendation
```

### Linting and Formatting

```bash
# Run golangci-lint (use this before submitting PRs)
make golangci

# Auto-fix linting issues
make golangci-fix

# Format Go files
make fmt

# Check go.mod tidiness
make test-tidy

# Run go mod tidy
make tidy
```

### Code Generation

```bash
# Update generated code (CRDs, clientsets, informers, listers)
make codegen

# Generate manifests
make manifest
```

### Documentation and Verification

```bash
# Verify docs, spelling, and TOC
make verify

# Update Table of Contents in docs
make toc

# Run markdownlint
make markdownlint

# Fix markdown lint issues
make markdownlint-fix

# Check copyright headers
make check-copyright

# Add copyright headers
make add-copyright
```

### Docker Images

```bash
# Build ClickHouse monitor image
make clickhouse-monitor

# Build Theia manager image
make theia-manager

# Build ClickHouse server image
make clickhouse-server

# Build Spark jobs image
make spark-jobs
```

### Cleaning

```bash
# Clean build artifacts and caches
make clean
```

## Architecture

### Core Components

**Theia Manager** (`cmd/theia-manager/`): The main control plane component that runs as a Kubernetes Deployment. It exposes an API server with three API groups:
- `intelligence.theia.antrea.io/v1alpha1`: NetworkPolicyRecommendation and ThroughputAnomalyDetector CRDs
- `stats.theia.antrea.io/v1alpha1`: ClickHouse status APIs
- `system.theia.antrea.io/v1alpha1`: Support bundle generation

**Theia CLI** (`pkg/theia/`): Command-line tool that interacts with Theia Manager for:
- Policy recommendation jobs (`policy-recommendation` or `pr`)
- Throughput anomaly detection (`throughput-anomaly-detection` or `tad`)
- ClickHouse status monitoring

**Controllers** (`pkg/controller/`):
- `networkpolicyrecommendation`: Manages NetworkPolicy recommendation Spark jobs
- `anomalydetector`: Manages throughput anomaly detection Spark jobs
Both controllers create/monitor Spark applications and manage their lifecycle

**API Server** (`pkg/apiserver/`): Custom Kubernetes API server implementation that:
- Uses certificate-based authentication with CA cert rotation
- Implements REST storage for custom resources
- Provides queriers for ClickHouse, NetworkPolicy recommendations, and anomaly detection

### Plugins

**Go Plugins**:
- `clickhouse-monitor`: Monitors ClickHouse storage and deletes old records when threshold is reached
- `clickhouse-schema-management`: Manages ClickHouse database schema migrations

**Python Plugins** (PySpark jobs):
- `policy-recommendation`: Analyzes flow data to generate NetworkPolicy recommendations
- `anomaly-detection`: Detects throughput anomalies in network flows
- `grafana-custom-plugins`: TypeScript-based custom Grafana visualizations (Sankey, Chord)

### Data Flow

1. Antrea Flow Exporter → Flow Aggregator → ClickHouse (flow records storage)
2. User triggers jobs via Theia CLI → Theia Manager API
3. Controller creates SparkApplication CR → Spark Operator executes Python job
4. Spark job queries ClickHouse → Processes flows → Stores results back in ClickHouse
5. User retrieves results via CLI or views in Grafana

### Key Packages

- `pkg/apis/`: CRD definitions and API types (intelligence, stats, system, crd)
- `pkg/client/`: Generated clientsets, informers, and listers for CRDs
- `pkg/querier/`: Interfaces for querying ClickHouse and job status
- `pkg/util/clickhouse/`: ClickHouse connection and query utilities
- `pkg/util/k8s/`: Kubernetes client utilities
- `pkg/support/`: Support bundle generation logic

## Testing Strategy

**Unit Tests**: Standard Go tests with race detection enabled. Tests use mocks for external dependencies (SQL, Kubernetes clients, Spark operators).

**E2E Tests** (`test/e2e/`): Integration tests that require:
- Kind cluster with Antrea deployed
- Flow Aggregator with ClickHouse
- Theia components installed
- Run via Jenkins CI or manually with `/theia-test-e2e` trigger phrase

**Multi-Cluster Tests** (`test/e2e_mc/`): Tests for multi-cluster monitoring scenarios.

## Development Notes

### Snowflake Integration

The `snowflake/` directory contains a **no longer maintained** feature (last tested for v0.7.1) that allowed using Snowflake instead of ClickHouse. It has its own `go.mod` and separate build/test commands. Avoid modifying unless reviving the feature.

### Spark Job Development

When modifying Python plugins, test locally before building Docker images:
1. Set up PySpark environment with required dependencies
2. Test against ClickHouse with sample data
3. Ensure proper error handling for missing/malformed data
4. Update corresponding `_test.py` files

### ClickHouse Schema Changes

Schema changes require:
1. Adding migration script in `clickhouse-schema-management` plugin
2. Testing migration on existing data
3. Updating queries in affected components (queriers, CLI commands, Spark jobs)

### Custom Resource Development

When adding/modifying CRDs:
1. Update types in `pkg/apis/{group}/{version}/types.go`
2. Run `make codegen` to regenerate clients
3. Add/update controller logic in `pkg/controller/`
4. Add REST storage in `pkg/apiserver/registry/`
5. Add CLI commands in `pkg/theia/commands/`

### CI/CD Workflows

PRs trigger:
- Unit tests (`test-unit`)
- Linting (`golangci-lint`)
- Go module tidiness check
- Copyright header verification
- Manifest generation check
- Documentation verification (spelling, TOC, markdown links)
- Snowflake tests (if snowflake/ files changed)

### Version Management

Version information is injected at build time via `versioning.mk`:
- `VERSION`: Semantic version from `VERSION` file
- `GIT_SHA`: Git commit hash
- `GIT_TREE_STATE`: Clean or dirty working tree
- `RELEASE_STATUS`: Release or unreleased
