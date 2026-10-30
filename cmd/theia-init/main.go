// Copyright 2026 Antrea Authors
// SPDX-License-Identifier: Apache-2.0

// theia-init implements the numeric recursive chown used by the Helm init containers.
package main

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

func chown(args []string, change func(string, int, int) error) error {
	if len(args) < 3 || args[0] != "-R" {
		return fmt.Errorf("expected arguments: -R UID:GID PATH")
	}
	owner := strings.Split(args[1], ":")
	if len(owner) != 2 {
		return fmt.Errorf("owner must be numeric UID:GID")
	}
	uid, err := strconv.Atoi(owner[0])
	if err != nil || uid < 0 {
		return fmt.Errorf("invalid numeric UID")
	}
	gid, err := strconv.Atoi(owner[1])
	if err != nil || gid < 0 {
		return fmt.Errorf("invalid numeric GID")
	}
	for _, root := range args[2:] {
		// Paths are configured volume mounts, not remote input; link targets are never followed.
		// #nosec G703 -- A filesystem ownership utility must accept its configured target path.
		err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, walkErr error) error {
			if walkErr != nil {
				return walkErr
			}
			// Lchown changes the link itself; WalkDir never follows symlink targets.
			return change(path, uid, gid)
		})
		if err != nil {
			return err
		}
	}
	return nil
}

func main() {
	if err := chown(os.Args[1:], os.Lchown); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
