#!/usr/bin/env bash
# Compile firmware/smart_mount.ino for ESP32 on this machine. No board, no flash.
# Needs arduino-cli (https://arduino.github.io/arduino-cli/). The esp32 core is
# several GB. Not run in CI — this repo has no CI on purpose.
#
# On success it prints the sha256 of the .ino. Put it, with the flash/RAM
# numbers, into BUILD in src/lib/case.js; test/firmware-build.test.js checks it.
set -euo pipefail
CORE="${CORE:-esp32:esp32@3.3.12}"
FQBN="${FQBN:-esp32:esp32:esp32}"
root="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/smart_mount"
cp "$root/firmware/smart_mount.ino" "$tmp/smart_mount/"
arduino-cli config add board_manager.additional_urls \
  https://espressif.github.io/arduino-esp32/package_esp32_index.json 2>/dev/null || true
arduino-cli core update-index
arduino-cli core install "$CORE"
arduino-cli lib install "BH1750@1.3.0" "AccelStepper@1.64" "ArduinoJson@7.4.3"
arduino-cli compile --clean --fqbn "$FQBN" "$tmp/smart_mount"
echo "inoSha256: $(sha256sum "$root/firmware/smart_mount.ino" | cut -d' ' -f1)"
