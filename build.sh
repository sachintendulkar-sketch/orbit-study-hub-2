#!/usr/bin/env bash
# Render build script. Exit immediately if any command fails.
set -o errexit

python -m pip install --upgrade pip
python -m pip install -r requirements.txt
