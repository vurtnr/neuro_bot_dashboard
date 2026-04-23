#!/bin/bash
set -e

VERSION=${1:-latest}

set -a
source .env.local
set +a

IMAGE=bizdevops-crepo.trinasolar.com/z5a9f1/docker-local/robot_monitoring

docker build \
  --platform=linux/amd64 \
  --build-arg NEXT_PUBLIC_ROBOT_BASE_URL="$NEXT_PUBLIC_ROBOT_BASE_URL" \
  --build-arg NEXT_PUBLIC_ROBOT_VIDEO_BASE_URL="$NEXT_PUBLIC_ROBOT_VIDEO_BASE_URL" \
  --build-arg NEXT_PUBLIC_PLANT_CREATED_WS_URL="$NEXT_PUBLIC_PLANT_CREATED_WS_URL" \
  --build-arg NEXT_PUBLIC_TIANDITU_KEY="$NEXT_PUBLIC_TIANDITU_KEY" \
  -t ${IMAGE}:${VERSION} \
  -t ${IMAGE}:latest .
