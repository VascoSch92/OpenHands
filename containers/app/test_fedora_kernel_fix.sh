#!/bin/bash
# Test script to verify the Poetry platform_release fix for Fedora kernel versions.
# Verifies the fix for GitHub issue #13813.
#
# Usage: ./containers/app/test_fedora_kernel_fix.sh

set -e

cd "$(git rev-parse --show-toplevel)"

echo "=== Building test image to verify the Fedora kernel fix ==="

docker build --no-cache --progress=plain -f - . <<'DOCKERFILE'
FROM python:3.13.7-slim-trixie

WORKDIR /app

ENV POETRY_NO_INTERACTION=1 \
    POETRY_VIRTUALENVS_IN_PROJECT=1 \
    POETRY_VIRTUALENVS_CREATE=1

RUN pip install poetry --break-system-packages

COPY pyproject.toml poetry.lock ./
RUN touch README.md

# Step 1: Fake a Fedora kernel version
RUN SITE_PKG=$(python3 -c "import site; print(site.getsitepackages()[0])") && \
    echo "import platform; platform.release = lambda: '6.18.6-200.fc43.x86_64'" \
      > "$SITE_PKG/aaa_fake_kernel.pth"

# Step 2: Verify the fake kernel is active
RUN python3 -c "import platform; v = platform.release(); print('Fake kernel:', v); assert v == '6.18.6-200.fc43.x86_64', f'Fake not active: {v}'"

# Step 3: Apply the fix (same .pth as in the real Dockerfile)
RUN SITE_PKG=$(python3 -c "import site; print(site.getsitepackages()[0])") && \
    echo "import platform; platform.release = (lambda _orig=platform.release: _orig().split('-')[0])" \
      > "$SITE_PKG/fix_platform_release.pth"

# Step 4: Verify the fix sanitizes the kernel version
RUN python3 -c "import platform; v = platform.release(); print('Sanitized kernel:', v); assert v == '6.18.6', f'Expected 6.18.6 but got: {v}'"

# Step 5: Confirm poetry install succeeds
RUN export POETRY_CACHE_DIR=/tmp/poetry_cache && \
    poetry install --no-root --dry-run && \
    echo "SUCCESS: poetry install passed with fake Fedora kernel + fix applied"
DOCKERFILE

echo ""
echo "=== Test passed: fix verified ==="
