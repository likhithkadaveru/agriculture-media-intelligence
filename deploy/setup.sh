#!/bin/bash
#
# Provision a fresh Ubuntu box to run the collector. Works unchanged on
# Oracle Cloud Always Free (ARM) and Hetzner (x86) — both are plain Ubuntu.
#
#   curl -fsSL <raw-url>/deploy/setup.sh | sudo bash
# or, after cloning:
#   sudo bash deploy/setup.sh
#
# Deliberately does NOT write secrets. It stops and tells you what to paste,
# because a script that takes API keys as arguments puts them in shell history
# and in the process table.
set -euo pipefail

REPO="https://github.com/likhithkadaveru/agriculture-media-intelligence.git"
BRANCH="${BRANCH:-main}"
DIR=/opt/agri

if [ "$(id -u)" -ne 0 ]; then echo "Run with sudo." >&2; exit 1; fi

echo "==> Node 24 + git"
apt-get update -qq
apt-get install -y -qq curl git ca-certificates
curl -fsSL https://deb.nodesource.com/setup_24.x | bash - >/dev/null
apt-get install -y -qq nodejs

echo "==> service user"
id -u agri >/dev/null 2>&1 || useradd --system --create-home --home-dir "$DIR" --shell /usr/sbin/nologin agri

echo "==> code"
if [ -d "$DIR/.git" ]; then
  sudo -u agri git -C "$DIR" fetch --quiet origin && sudo -u agri git -C "$DIR" checkout --quiet "$BRANCH" && sudo -u agri git -C "$DIR" pull --quiet
else
  sudo -u agri git clone --quiet --branch "$BRANCH" "$REPO" "$DIR"
fi
cd "$DIR"
sudo -u agri npm ci --omit=dev --silent || sudo -u agri npm ci --silent

echo "==> systemd"
cp "$DIR/deploy/agri-scheduler.service" /etc/systemd/system/
systemctl daemon-reload

if [ ! -f "$DIR/.env.local" ]; then
  install -o agri -g agri -m 600 /dev/null "$DIR/.env.local"
  cat <<'MSG'

Not started — .env.local is empty.

Add these on the server (nano /opt/agri/.env.local), then start it:

  DATABASE_URL=          # same Neon URL the site uses
  OPENAI_API_KEY=        # enrichment: stance, district, department
  APIFY_API_TOKEN=       # X/Instagram collection + YouTube transcripts
  YOUTUBE_API_KEY=       # discovery + live telecasts
  VAPID_PUBLIC_KEY=      # push. Without these alerts are silently inert
  VAPID_PRIVATE_KEY=
  VAPID_SUBJECT=mailto:you@example.com
  PUBLIC_SITE_URL=https://agriculture.likhithlabs.com

  sudo chmod 600 /opt/agri/.env.local
  sudo systemctl enable --now agri-scheduler
  journalctl -u agri-scheduler -f

MSG
  exit 0
fi

systemctl enable --now agri-scheduler
echo "Started. Follow with: journalctl -u agri-scheduler -f"
