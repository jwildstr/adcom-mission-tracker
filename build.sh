#!/bin/bash

# Automatically retrieve the latest commit hash
export COMMIT_HASH=$(git rev-parse --short=8 HEAD)

docker network inspect adcom-sites >/dev/null 2>&1 || docker network create adcom-sites

# Run Docker Compose with the build argument
docker compose up --build -d
