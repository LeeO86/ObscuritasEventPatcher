FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends git libprotobuf-dev protobuf-compiler \
  && rm -rf /var/lib/apt/lists/*
