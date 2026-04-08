#!/bin/bash
# Test script to verify the Poetry platform_release fix for Fedora kernel versions.
# Verifies the fix for GitHub issue #13813.
#
# Usage: ./containers/app/test_fedora_kernel_fix.sh

set -e

cd "$(git rev-parse --show-toplevel)"

echo "=== Building test image to verify the Fedora kernel fix ==="

docker build --no-cache -f - . <<'DOCKERFILE'
FROM python:3.13.7-slim-trixie

WORKDIR /app

ENV POETRY_NO_INTERACTION=1 \
    POETRY_VIRTUALENVS_IN_PROJECT=1 \
    POETRY_VIRTUALENVS_CREATE=1

RUN pip install poetry --break-system-packages

COPY pyproject.toml poetry.lock ./
RUN touch README.md

# Fake a Fedora kernel version AND apply the fix
RUN SITE_PKG=$(python3 -c "import site; print(site.getsitepackages()[0])") && \
    echo "import platform; platform.release = lambda: '6.18.6-200.fc43.x86_64'" \
      > "$SITE_PKG/aaa_fake_kernel.pth" && \
    echo "import platform; platform.release = (lambda _orig=platform.release: _orig().split('-')[0])" \
      > "$SITE_PKG/fix_platform_release.pth" && \
    python3 -c "import platform; v = platform.release(); print('Kernel version seen by Poetry:', v); assert v == '6.18.6', f'Expected 6.18.6 but got: {v}'"

# Confirm poetry install succeeds with the fake Fedora kernel + fix applied
RUN export POETRY_CACHE_DIR=/tmp/poetry_cache && \
    poetry install --no-root --dry-run && \
    echo "SUCCESS: poetry install passed with Fedora kernel version"
DOCKERFILE

echo ""
echo "=== Test passed: fix works correctly ==="
