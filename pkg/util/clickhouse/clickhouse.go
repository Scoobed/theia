// Copyright 2022 Antrea Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package clickhouse

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/kubernetes"

	"antrea.io/theia/pkg/util/env"
	"antrea.io/theia/pkg/util/k8s"
)

const (
	usernameKey         = "CLICKHOUSE_USERNAME"
	passwordKey         = "CLICKHOUSE_PASSWORD"
	urlKey              = "CLICKHOUSE_URL"
	ServiceName         = "clickhouse-clickhouse"
	ServicePortProtocal = "TCP"
	// #nosec G101: false positive triggered by variable name which includes "secret"
	SecretName = "clickhouse-secret"
	// Ping to ClickHouse time out if it fails for 30 seconds.
	pingTimeout = 30 * time.Second
	// Retry ping to ClickHouse every second if it fails.
	pingRetryInterval = 1 * time.Second
)

var (
	openSql         = sql.Open
	createK8sClient = k8s.CreateK8sClient
)

func SetupConnection(client kubernetes.Interface) (connect *sql.DB, err error) {
	dsn, err := getClickHouseDSN(client)
	if err != nil {
		return nil, fmt.Errorf("failed to get ClickHouse DSN: %v", err)
	}
	connect, err = Connect(dsn)
	if err != nil {
		return nil, fmt.Errorf("error when connecting to ClickHouse, %v", err)
	}
	return connect, nil
}

func Connect(dsn string) (*sql.DB, error) {
	// Open the database and ping it
	var connect *sql.DB
	var err error
	connect, err = openSql("clickhouse", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open ClickHouse: %v", err)
	}
	var errMessages []string
	ctx := context.Background()
	if err = wait.PollImmediate(pingRetryInterval, pingTimeout, func() (done bool, err error) {
		if err := connect.PingContext(ctx); err != nil {
			if exception, ok := err.(*clickhouse.Exception); ok {
				errMessages = append(errMessages, fmt.Errorf("error message: %v", exception.Message).Error())
			} else {
				errMessages = append(errMessages, err.Error())
			}
			return false, nil
		}
		return true, nil
	}); err != nil {
		return nil, fmt.Errorf("failed to connect to ClickHouse after %s, error list: [\n%v]", pingTimeout, strings.Join(errMessages, ",\n"))
	}

	return connect, nil
}

func GetSecret(client kubernetes.Interface, namespace string) (username string, password string, err error) {
	secret, err := client.CoreV1().Secrets(namespace).Get(context.TODO(), SecretName, metav1.GetOptions{})
	if err != nil {
		return username, password, fmt.Errorf("error when finding the ClickHouse secret. Error: %v", err)
	}
	usernameByte, ok := secret.Data["username"]
	if !ok {
		return username, password, fmt.Errorf("error when getting the ClickHouse username")
	}
	passwordByte, ok := secret.Data["password"]
	if !ok {
		return username, password, fmt.Errorf("error when getting the ClickHouse password")
	}
	username = string(usernameByte)
	password = string(passwordByte)
	return username, password, nil
}

func getClickHouseDSN(client kubernetes.Interface) (string, error) {
	baseURL := os.Getenv(urlKey)
	username := os.Getenv(usernameKey)
	password := os.Getenv(passwordKey)

	var err error
	if baseURL == "" || username == "" || password == "" {
		if client == nil {
			client, err = createK8sClient()
			if err != nil {
				return "", fmt.Errorf("failed to create k8s client: %v", err)
			}
		}
		serviceIP, servicePort, err := k8s.GetServiceAddr(client, ServiceName, env.GetTheiaNamespace(), ServicePortProtocal)
		if err != nil {
			return "", fmt.Errorf("error when getting the ClickHouse Service address: %v", err)
		}
		baseURL = fmt.Sprintf("%s:%d", serviceIP, servicePort)
		username, password, err = GetSecret(client, env.GetTheiaNamespace())
		if err != nil {
			return "", err
		}
	}
	// Parse baseURL to extract host and port
	baseURL = strings.TrimPrefix(baseURL, "tcp://")
	baseURL = strings.TrimPrefix(baseURL, "http://")
	baseURL = strings.TrimPrefix(baseURL, "https://")

	// Build DSN for database/sql with ClickHouse v2 driver
	// Format: clickhouse://username:password@host:port/database?param1=value1&param2=value2
	dsn := fmt.Sprintf("clickhouse://%s:%s@%s/default?dial_timeout=5s&max_execution_time=60", username, password, baseURL)
	return dsn, nil
}
