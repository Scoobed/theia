# theia

![Version: 0.9.4](https://img.shields.io/badge/Version-0.9.4-informational?style=flat-square) ![Type: application](https://img.shields.io/badge/Type-application-informational?style=flat-square) ![AppVersion: 0.9.4](https://img.shields.io/badge/AppVersion-0.9.4-informational?style=flat-square)

Antrea Network Flow Visibility

**Homepage:** <https://antrea.io/>

## Source Code

* <https://github.com/antrea-io/theia>

## Requirements

Kubernetes: `>= 1.16.0-0`

| Repository | Name | Version |
|------------|------|---------|
| https://helm.altinity.com | altinity-clickhouse-operator | 0.27.4 |

## Private registry authentication

The 0.9.4 images and OCI chart at `ghcr.io/scoobed` require authentication.
Create a `kubernetes.io/dockerconfigjson` Secret in the release namespace and
the operator namespace (`kube-system` by default). Configure `imagePullSecrets`,
`altinity-clickhouse-operator.imagePullSecrets`, and
`altinity-clickhouse-operator.crdHook.imagePullSecrets`; Helm registry login alone
does not authenticate Kubernetes image pulls.

See the [GHCR pull-secret setup guide](../../../README.md#private-ghcr-image-pulls)
for token permissions, credential-safe Secret creation, example values, OCI
installation, troubleshooting, and rotation. Allow `--timeout 15m` for schema
initialization, and preserve existing storage/application values when upgrading.

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| imagePullSecrets | list | `[]` | Pull Secrets in the release namespace. |
| altinity-clickhouse-operator.operator.image | object | `{"repository":"ghcr.io/scoobed/theia-clickhouse-operator","tag":"0.9.4"}` | Hardened operator release image. |
| altinity-clickhouse-operator.metrics.image | object | `{"repository":"ghcr.io/scoobed/theia-metrics-exporter","tag":"0.9.4"}` | Hardened metrics exporter release image. |
| altinity-clickhouse-operator.crdHook.image | object | `{"repository":"ghcr.io/scoobed/theia-kubectl","tag":"0.9.4","pullPolicy":"IfNotPresent"}` | Hardened kubectl image for CRD hooks. |
| grafana.initChownData.image | object | `{"repository":"ghcr.io/scoobed/theia-init","tag":"0.9.4","pullPolicy":"IfNotPresent"}` | Ownership helper for the Grafana data volume. |
| clickhouse.cluster.installZookeeper.initChownData.image | object | `{"repository":"ghcr.io/scoobed/theia-init","tag":"0.9.4","pullPolicy":"IfNotPresent"}` | Ownership helper for ZooKeeper storage. |
| clickhouse.schemaCheck | object | `{"enable":true,"timeoutSeconds":600}` | Wait for distributed schema readiness after installation or upgrade. |
| altinity-clickhouse-operator | object | `{"enabled":true,"namespaceOverride":"kube-system","fullnameOverride":"clickhouse-operator","imagePullSecrets":[],"crdHook":{"imagePullSecrets":[],"image":{"repository":"ghcr.io/scoobed/theia-kubectl","tag":"0.9.4","pullPolicy":"IfNotPresent"}},"rbac":{"namespaceScoped":false},"secret":{"username":"clickhouse_operator","password":"clickhouse_operator_password"},"operator":{"image":{"repository":"ghcr.io/scoobed/theia-clickhouse-operator","tag":"0.9.4"}},"metrics":{"image":{"repository":"ghcr.io/scoobed/theia-metrics-exporter","tag":"0.9.4"}}}` | The ClickHouse Operator is installed via the official Altinity Helm chart (https://github.com/Altinity/helm-charts/tree/main/charts/clickhouse-operator) as a chart dependency (see Chart.yaml), configured directly under its own chart name here (not aliased: the subchart's Deployment template uses the literal .Chart.Name for its container name, which an alias would turn into an invalid, non-RFC1123 camelCase value). Run `helm dependency update` after bumping the pinned version in Chart.yaml. CRDs are installed/updated automatically via the subchart's pre-install/pre-upgrade hooks (crdHook.enable, left at its default of true). See `helm show values altinity/altinity-clickhouse-operator --version <ver>` for the full set of available values. |
| altinity-clickhouse-operator.enabled | bool | `true` | Whether to install the ClickHouse Operator via this chart. |
| altinity-clickhouse-operator.fullnameOverride | string | `"clickhouse-operator"` | Pin resource names to "clickhouse-operator" (ServiceAccount, Secret, Deployment, ClusterRole/ClusterRoleBinding) regardless of release name. |
| altinity-clickhouse-operator.metrics.image.repository | string | `"ghcr.io/scoobed/theia-metrics-exporter"` | Container image repository for the ClickHouse Metrics Exporter. |
| altinity-clickhouse-operator.metrics.image.tag | string | `"0.9.4"` | Container image tag for the ClickHouse Metrics Exporter. |
| altinity-clickhouse-operator.namespaceOverride | string | `"kube-system"` | Namespace to install the operator into. Empty uses the release's own namespace; "kube-system" preserves the traditional singleton/watch-all- namespaces pattern. |
| altinity-clickhouse-operator.operator.image.repository | string | `"ghcr.io/scoobed/theia-clickhouse-operator"` | Container image repository for the ClickHouse Operator. |
| altinity-clickhouse-operator.operator.image.tag | string | `"0.9.4"` | Container image tag for the ClickHouse Operator. |
| altinity-clickhouse-operator.rbac.namespaceScoped | bool | `false` | Use cluster-scoped ClusterRole/ClusterRoleBinding (false) or namespace-scoped Role/RoleBinding (true). |
| altinity-clickhouse-operator.secret.password | string | `"clickhouse_operator_password"` | Password for the operator's own ClickHouse access credentials. |
| altinity-clickhouse-operator.secret.username | string | `"clickhouse_operator"` | Username for the operator's own ClickHouse access credentials. |
| clickhouse.cluster.installZookeeper.image | object | `{"repository":"ghcr.io/scoobed/theia-zookeeper","pullPolicy":"IfNotPresent","tag":"0.9.4"}` | Container image used by the ZooKeeper. |
| clickhouse.cluster.installZookeeper.initChownData | object | `{"enable":true,"image":{"repository":"ghcr.io/scoobed/theia-init","tag":"0.9.4","pullPolicy":"IfNotPresent"},"resources":{}}` | Init container that fixes ownership of the ZooKeeper data volume to securityContext.runAsUser/fsGroup before ZooKeeper starts, allowing the main container to run as a non-root user (e.g. nobody). Disable if the volume's ownership is already managed externally (e.g. via the NFS export). |
| clickhouse.cluster.installZookeeper.initChownData.image | object | `{"repository":"ghcr.io/scoobed/theia-init","tag":"0.9.4","pullPolicy":"IfNotPresent"}` | Hardened helper with chown; kept separate from the Java runtime. |
| clickhouse.cluster.installZookeeper.initChownData.resources | object | `{}` | Resource requests/limits for the init-chown-data container. |
| clickhouse.cluster.installZookeeper.priorityClassName | string | `""` | Pod priorityClassName for the ZooKeeper Pods. |
| clickhouse.cluster.installZookeeper.replicas | int | `1` | Number of ZooKeeper replicas. It is recommended to be odd. When deploying ClickHouse cluster with more than 1 replica, 3 is the minimum number of ZooKeeper hosts required to manage replication and fault tolerance. Please refer to <https://zookeeper.apache.org/doc/current/zookeeperStarted.html#sc_RunningReplicatedZooKeeper> for more information. |
| clickhouse.cluster.installZookeeper.resources | object | `{"requests":{"memory":"512M","cpu":"1"},"limits":{"memory":"4Gi","cpu":"2"}}` | Resource requests/limits for the ZooKeeper container. |
| clickhouse.cluster.installZookeeper.securityContext | object | `{"runAsUser":65532,"fsGroup":65532}` | Set securityContext. Use a specific uid, gid for zookeeper. |
| clickhouse.cluster.installZookeeper.storage.createPersistentVolume.local.affinity | object | `{}` | Affinity for the Local PersistentVolume. By default it requires to label the Node used to store the Zookeeper data with "antrea.io/zookeeper-data-node=". |
| clickhouse.cluster.installZookeeper.storage.createPersistentVolume.local.path | string | `"/data/zookeeper"` | The local path. Required when type is "Local". |
| clickhouse.cluster.installZookeeper.storage.createPersistentVolume.nfs.host | string | `""` | The NFS server hostname or IP address. Required when type is "NFS". |
| clickhouse.cluster.installZookeeper.storage.createPersistentVolume.nfs.path | string | `""` | The path exported on the NFS server. Required when type is "NFS". |
| clickhouse.cluster.installZookeeper.storage.createPersistentVolume.type | string | `""` | Type of PersistentVolume. Can be set to "Local" or "NFS". Please set this value to use a PersistentVolume created by Theia. |
| clickhouse.cluster.installZookeeper.storage.persistentVolumeClaimSpec | object | `{"storageClassName":"standard"}` | Specification for PersistentVolumeClaim. This is ignored if createPersistentVolume.type is non-empty. To use a custom PersistentVolume, please set storageClassName: "" volumeName: "<my-pv>". To dynamically provision a PersistentVolume, please set storageClassName: "<my-storage-class>". Memory storage is used if both createPersistentVolume.type and persistentVolumeClaimSpec are empty. |
| clickhouse.cluster.installZookeeper.storage.size | string | `"5Gi"` | Zookeeper storage size. Can be a plain integer or as a fixed-point number using one of these quantity suffixes: E, P, T, G, M, K. Or the power-of-two equivalents: Ei, Pi, Ti, Gi, Mi, Ki. |
| clickhouse.cluster.podDistribution | list | `[{"type":"MaxNumberPerNode","number":1,"topologyKey":"kubernetes.io/hostname"}]` | Affinity for the ClickHouse Pods. By default, it allows only one ClickHouse instance per Node. Please refer to <https://github.com/Altinity/clickhouse-operator/blob/master/docs/chi-examples/99-clickhouseinstallation-max.yaml> for other distributions. |
| clickhouse.cluster.replicas | int | `1` | Number of ClickHouse replicas in each shard. |
| clickhouse.cluster.shards | int | `1` | Number of ClickHouse shards in the cluster. |
| clickhouse.cluster.zookeeperHosts | list | `[]` | To use a pre-installed ZooKeeper for ClickHouse data replication, please provide a list of your ZooKeeper hosts. To install a customized ZooKeeper, refer to <https://github.com/Altinity/clickhouse-operator/blob/master/docs/zookeeper_setup.md> |
| clickhouse.connectionSecret | object | `{"username":"clickhouse_operator","password":"clickhouse_operator_password","readOnlyUsername":"readonly","readOnlyPassword":"readonly_password"}` | Credentials to connect to ClickHouse. They will be stored in a secret. |
| clickhouse.image | object | `{"repository":"ghcr.io/scoobed/theia-clickhouse-server","pullPolicy":"IfNotPresent","tag":"0.9.4"}` | Container image used by ClickHouse. |
| clickhouse.logger.count | int | `4` | The number of archived log files that ClickHouse stores. |
| clickhouse.logger.level | string | `"information"` | Logging level. Acceptable values: trace, debug, information, warning, error. |
| clickhouse.logger.size | string | `"100M"` | Size of log files. Applies to log and errorlog. Once the file reaches size, ClickHouse archives and renames it, and creates a new log file in its place. |
| clickhouse.monitor.deletePercentage | float | `0.5` | The percentage of records in ClickHouse that will be deleted when the storage grows above threshold. Vary from 0 to 1. |
| clickhouse.monitor.enable | bool | `true` | Determine whether to run a monitor to periodically check the ClickHouse memory usage and clean data. |
| clickhouse.monitor.execInterval | string | `"1m"` | The time interval between two round of monitoring. Can be a plain integer using one of these unit suffixes ns, us (or µs), ms, s, m, h. |
| clickhouse.monitor.image | object | `{"repository":"ghcr.io/scoobed/theia-clickhouse-monitor","pullPolicy":"IfNotPresent","tag":"0.9.4"}` | Container image used by the ClickHouse Monitor. |
| clickhouse.monitor.resources | object | `{}` | Resource requests/limits for the ClickHouse Monitor container. |
| clickhouse.monitor.skipRoundsNum | int | `3` | The number of rounds for the monitor to stop after a deletion to wait for the ClickHouse MergeTree Engine to release memory. |
| clickhouse.monitor.threshold | float | `0.5` | The storage percentage at which the monitor starts to delete old records. Vary from 0 to 1. |
| clickhouse.priorityClassName | string | `""` | Pod priorityClassName for the ClickHouse Pods (server + monitor containers share one pod, so this applies to both). |
| clickhouse.resources | object | `{}` | Resource requests/limits for the ClickHouse server container. |
| clickhouse.schemaCheck | object | `{"enable":true,"timeoutSeconds":600}` | Wait for operator reconciliation and initialized distributed tables. |
| clickhouse.securityContext | object | `{}` | Set securityContext for the ClickHouse server and monitor Pods. Leave empty (the default) to run as the image's default user (normally root, which the container needs in order to chown /var/lib/clickhouse on startup). To run as a non-root user (e.g. nobody), set runAsUser and runAsGroup here to match storage.ownerUser/ownerGroup below. Note: the data volume must already be owned by that user/group (e.g. by first deploying once with the default root user, or by pre-provisioning the volume/NFS export with matching ownership), since the in-container chown can only succeed as root or as a no-op self-chown. |
| clickhouse.service.httpPort | int | `8123` | HTTP port number for ClickHouse service. |
| clickhouse.service.secureConnection.commonName | string | `"clickhouse-clickhouse.flow-visibility.svc"` | Subject's common name. Only used when selfSignedCert is true. |
| clickhouse.service.secureConnection.daysValid | int | `365` | Number of days for which the certificate will be valid. There is no automatic rotation with this method. This is ignored if selfSignedCert is false. |
| clickhouse.service.secureConnection.dnsNames | list | `[]` | Optional list of alternate DNS names; may be nil. Only used when selfSignedCert is true. |
| clickhouse.service.secureConnection.enable | bool | `false` | Determine whether to enable secure connection to ClickHouse |
| clickhouse.service.secureConnection.httpsPort | int | `8443` | HTTP protocol TLS port. |
| clickhouse.service.secureConnection.ipAddresses | list | `[]` | Optional list of IPs; may be nil. Only used when selfSignedCert is true. |
| clickhouse.service.secureConnection.secureTcpPort | int | `9440` | TCP protocol TLS port. |
| clickhouse.service.secureConnection.selfSignedCert | bool | `true` | Indicates whether to use auto-generated self-signed TLS certificates. If false, a Secret named "clickhouse-tls" must be provided with the following keys: tls.crt and tls.key. If true, the following fields commonName, ipAddresses, dnsNames, daysValid need to be provided. |
| clickhouse.service.tcpPort | int | `9000` | TCP port number for ClickHouse service. |
| clickhouse.service.type | string | `"ClusterIP"` | The type of Service exposing ClickHouse. It can be one of ClusterIP, NodePort or LoadBalancer. |
| clickhouse.storage.createPersistentVolume.local.affinity | object | `{}` | Affinity for the Local PersistentVolume. By default it requires to label the Node used to store the ClickHouse data with "antrea.io/clickhouse-data-node=". |
| clickhouse.storage.createPersistentVolume.local.nodes | list | `["kind-worker"]` | A list of Node hostnames. Required when type is "Local". Please make sure to provide (shards * replicas) Nodes. Each Node should meet affinity and have the path created on it. |
| clickhouse.storage.createPersistentVolume.local.path | string | `"/data/clickhouse"` | The local path. Required when type is "Local". |
| clickhouse.storage.createPersistentVolume.nfs.addresses | list | `["nfs.svc.cluster.local:/data"]` | A list of addresses for NFS shares in the format hostname:path, where hostname refers to NFS server hostname or IP address, and path refers to the path exported on the NFS server. Please provide (shards * replicas) addresses. |
| clickhouse.storage.createPersistentVolume.type | string | `""` | Type of PersistentVolume. Can be set to "Local" or "NFS". Please set this value to use a PersistentVolume created by Theia. |
| clickhouse.storage.ownerGroup | string | `"clickhouse"` | The group (name or numeric gid) that should own the ClickHouse data directory. Must match securityContext.runAsGroup/fsGroup when running as a non-root user such as nobody (65534). |
| clickhouse.storage.ownerUser | string | `"clickhouse"` | The user (name or numeric uid) that should own the ClickHouse data directory. Must match securityContext.runAsUser when running as a non-root user such as nobody (65534). |
| clickhouse.storage.persistentVolumeClaimSpec | object | `{"storageClassName":"standard"}` | Specification for PersistentVolumeClaim. This is ignored if createPersistentVolume.type is non-empty. To use a custom PersistentVolume, please set storageClassName: "" volumeName: "<my-pv>". To dynamically provision a PersistentVolume, please set storageClassName: "<my-storage-class>". Memory storage is used if both createPersistentVolume.type and persistentVolumeClaimSpec are empty. |
| clickhouse.storage.size | string | `"8Gi"` | ClickHouse storage size. Can be a plain integer or as a fixed-point number using one of these quantity suffixes: E, P, T, G, M, K. Or the power-of-two equivalents: Ei, Pi, Ti, Gi, Mi, Ki. |
| clickhouse.ttl | string | `"12 HOUR"` | Time to live for data in the ClickHouse. Can be a plain integer using one of these unit suffixes SECOND, MINUTE, HOUR, DAY, WEEK, MONTH, QUARTER, YEAR. |
| grafana.dashboards | list | `["homepage.json","flow_records_dashboard.json","pod_to_pod_dashboard.json","pod_to_service_dashboard.json","pod_to_external_dashboard.json","node_to_node_dashboard.json","networkpolicy_dashboard.json","network_topology_dashboard.json","all_ns_pod_to_pod_dashboard.json","all_ns_pod_to_service_dashboard.json","all_ns_pod_to_external_dashboard.json","all_ns_node_to_node_dashboard.json","all_ns_networkpolicy_dashboard.json","all_ns_network_topology_dashboard.json","denied_traffic_patterns_dashboard.json","denied_policy_accountability_dashboard.json"]` | The dashboards to be displayed in Grafana UI. The files must be put under provisioning/dashboards. |
| grafana.enable | bool | `true` | Determine whether to install Grafana. It is used as a data visualization and monitoring tool.   |
| grafana.extraVolumeMounts | list | `[]` | Additional volumeMounts to add to the Grafana container, paired with extraVolumes above. Rendered as-is via toYaml. |
| grafana.extraVolumes | list | `[]` | Additional volumes to add to the Grafana Pod (e.g. for mounting extra ConfigMaps, Secrets, or external plugin/provisioning sources). Must be used together with extraVolumeMounts. Rendered as-is via toYaml. |
| grafana.homeDashboard | string | `"homepage.json"` | Default home dashboard. |
| grafana.image | object | `{"repository":"ghcr.io/scoobed/theia-grafana","pullPolicy":"IfNotPresent","tag":"0.9.4"}` | Container image used by Grafana. |
| grafana.initChownData | object | `{"enable":true,"image":{"repository":"ghcr.io/scoobed/theia-init","tag":"0.9.4","pullPolicy":"IfNotPresent"},"resources":{}}` | Init container that fixes ownership of the Grafana data volume to securityContext.runAsUser/fsGroup before Grafana starts, allowing the main container to run as a non-root user (e.g. nobody). Disable if the volume's ownership is already managed externally (e.g. via the NFS export). |
| grafana.initChownData.resources | object | `{}` | Resource requests/limits for the init-chown-data container. |
| grafana.log | object | `{"mode":"console file","level":"info","log_rotate":"true","max_lines":"1000000","max_size_shift":"27","daily_rotate":"true","max_days":"7"}` | Grafana logging options. |
| grafana.log.daily_rotate | string | `"true"` | Enable daily rotation of files, valid options are false or true. Default is true. Only applicable when “file” used in [log] mode. |
| grafana.log.level | string | `"info"` | Logging level. Options are “debug”, “info”, “warn”, “error”, and “critical”. Default is info. |
| grafana.log.log_rotate | string | `"true"` | Enable automated log rotation, valid options are false or true. Default is true. When enabled use the max_lines, max_size_shift, daily_rotate and max_days to configure the behavior of the log rotation. Only applicable when “file” used in [log] mode. |
| grafana.log.max_days | string | `"7"` | Maximum number of days to keep log files. Default is "7". Only applicable when “file” used in [log] mode. |
| grafana.log.max_lines | string | `"1000000"` | Maximum lines per file before rotating it. Default is "1000000". Only applicable when “file” used in [log] mode. |
| grafana.log.max_size_shift | string | `"27"` | Maximum size of file before rotating it. Default is "27", which means 1 << 27, 128MB. Only applicable when “file” used in [log] mode. |
| grafana.log.mode | string | `"console file"` | Logging mode. Options are “console”, “file”, and “syslog”. Default is “console” and “file”. Use spaces to separate multiple modes, e.g. console file |
| grafana.loginSecret | object | `{"username":"admin","password":"admin"}` | Credentials to login to Grafana. They will be stored in a Secret. |
| grafana.priorityClassName | string | `""` | Pod priorityClassName for the Grafana Pod. |
| grafana.resources | object | `{"requests":{"cpu":"250m","memory":"750Mi"}}` | Resource requests/limits for the Grafana container. |
| grafana.securityContext | object | `{"runAsUser":65532,"runAsGroup":65532,"fsGroup":65532}` | Set securityContext. Use a specific uid, gid for grafana. |
| grafana.service.tcpPort | int | `3000` | TCP port number for the Grafana service. |
| grafana.service.type | string | `"NodePort"` | The type of Service exposing Grafana. It must be one of NodePort or LoadBalancer. |
| grafana.storage.createPersistentVolume.hostPath.path | string | `"/data/grafana"` | The host path. Required when type is "HostPath". |
| grafana.storage.createPersistentVolume.local.affinity | object | `{}` | Affinity for the Local PersistentVolume. By default it requires to label the Node used to store the Grafana configuration files with "antrea.io/grafana-config-node=". |
| grafana.storage.createPersistentVolume.local.path | string | `"/data/grafana"` | The local path. Required when type is "Local". |
| grafana.storage.createPersistentVolume.nfs.host | string | `""` | The NFS server hostname or IP address. Required when type is "NFS". |
| grafana.storage.createPersistentVolume.nfs.path | string | `""` | The path exported on the NFS server. Required when type is "NFS". |
| grafana.storage.createPersistentVolume.type | string | `"HostPath"` | Type of PersistentVolume. Can be set to "HostPath", "Local" or "NFS". Please set this value to use a PersistentVolume created by Theia. |
| grafana.storage.persistentVolumeClaimSpec | object | `{}` | Specification for PersistentVolumeClaim. This is ignored if createPersistentVolume.type is non-empty. To use a custom PersistentVolume, please set storageClassName: "" volumeName: "<my-pv>". To dynamically provision a PersistentVolume, please set storageClassName: "<my-storage-class>". HostPath storage is used if both createPersistentVolume.type and persistentVolumeClaimSpec are empty. |
| grafana.storage.size | string | `"1Gi"` | Grafana storage size. It is used to store Grafana configuration files. Can be a plain integer or as a fixed-point number using one of these quantity suffixes: E, P, T, G, M, K. Or the power-of-two equivalents: Ei, Pi, Ti, Gi, Mi, Ki. |
| imagePullSecrets | list | `[]` | GHCR pull Secrets in the release namespace for Theia Pods and schema hooks. Configure the operator's separate imagePullSecrets and crdHook.imagePullSecrets below as well; their Secrets must exist in the operator namespace. |
| sparkOperator.enable | bool | `false` | Determine whether to install Spark Operator. It is required to run Network Policy Recommendation and Throughput Anomaly Detection jobs. |
| sparkOperator.image | object | `{"repository":"ghcr.io/scoobed/theia-spark-operator","pullPolicy":"IfNotPresent","tag":"v1beta2-1.3.3-3.1.1"}` | Container image used by Spark Operator. |
| sparkOperator.name | string | `"theia"` | Name of Spark Operator. |
| sparkOperator.priorityClassName | string | `""` | Pod priorityClassName for the Spark Operator Pod. |
| sparkOperator.resources | object | `{}` | Resource requests/limits for the Spark Operator container. |
| theiaManager.apiServer.apiPort | int | `11347` | The port for the Theia Manager APIServer to serve on. |
| theiaManager.apiServer.selfSignedCert | bool | `true` | Indicates whether to use auto-generated self-signed TLS certificates. If false, a Secret named "theia-manager-tls" must be provided with the following keys: ca.crt, tls.crt, tls.key. |
| theiaManager.apiServer.tlsCipherSuites | string | `""` | Comma-separated list of cipher suites that will be used by the Theia Manager APIservers. If empty, the default Go Cipher Suites will be used. |
| theiaManager.apiServer.tlsMinVersion | string | `""` | TLS min version from: VersionTLS10, VersionTLS11, VersionTLS12, VersionTLS13. |
| theiaManager.enable | bool | `true` | Determine whether to install Theia Manager. |
| theiaManager.image | object | `{"repository":"ghcr.io/scoobed/theia-manager","pullPolicy":"IfNotPresent","tag":"0.9.4"}` | Container image used by Theia Manager. |
| theiaManager.logVerbosity | int | `0` | Log verbosity switch for Theia Manager. |
| theiaManager.priorityClassName | string | `""` | Pod priorityClassName for the Theia Manager Pod. |
| theiaManager.resources | object | `{}` | Resource requests/limits for the Theia Manager container. |

----------------------------------------------
Autogenerated from chart metadata using [helm-docs v1.7.0](https://github.com/norwoodj/helm-docs/releases/v1.7.0)
