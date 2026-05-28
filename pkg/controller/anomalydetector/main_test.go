// Copyright 2025 Antrea Authors
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

package anomalydetector

import (
	"os"
	"testing"

	clientfeatures "k8s.io/client-go/features"
)

func TestMain(m *testing.M) {
	// WatchListClient is enabled by default in k8s v1.35, but the fake CRD
	// client doesn't support the WatchList streaming protocol. Disable it so
	// informers in unit tests fall back to the standard List+Watch path.
	if fg, ok := clientfeatures.FeatureGates().(interface {
		Set(clientfeatures.Feature, bool) error
	}); ok {
		_ = fg.Set(clientfeatures.WatchListClient, false)
	}
	os.Exit(m.Run())
}
