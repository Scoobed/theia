// Copyright 2026 Antrea Authors
// SPDX-License-Identifier: Apache-2.0

package main

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestChownDoesNotFollowSymlinks(t *testing.T) {
	dir := t.TempDir()
	outside := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(outside, "untouched"), nil, 0600))
	require.NoError(t, os.Mkdir(filepath.Join(dir, "child"), 0700))
	require.NoError(t, os.Symlink(outside, filepath.Join(dir, "link")))
	visited := map[string]bool{}
	err := chown([]string{"-R", "65532:65532", dir}, func(path string, uid, gid int) error {
		require.Equal(t, 65532, uid)
		require.Equal(t, 65532, gid)
		visited[path] = true
		return nil
	})
	require.NoError(t, err)
	require.Len(t, visited, 3)
	require.True(t, visited[filepath.Join(dir, "link")])
	require.False(t, visited[filepath.Join(outside, "untouched")])
}

func TestChownRejectsInvalidArguments(t *testing.T) {
	for _, args := range [][]string{
		nil, {"-R", "root:root", "/"}, {"-R", "-1:0", "/"},
		{"-R", "0:-1", "/"}, {"-R", "0", "/"}, {"-R", "1:2:3", "/"},
	} {
		require.Error(t, chown(args, func(string, int, int) error {
			t.Fatal("must reject invalid arguments before changing ownership")
			return nil
		}))
	}
}
