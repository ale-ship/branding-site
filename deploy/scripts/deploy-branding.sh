#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  deploy-branding.sh  -  build and switch a release of the Noorcom Branding website
# ───────────────────────────────────────────────────────────────────────────
#  docs/RUNBOOK.md, "Deploying to the VPS". Run as root on the VPS:
#
#    deploy-branding.sh                 build the latest main and switch to it
#    deploy-branding.sh --rollback      switch back to the previous release
#    deploy-branding.sh --install       first time: user, folders, service, nginx site
#
#  A release is built completely before anything changes; the switch is one rename of the
#  `current` link; if the new release doesn't answer within 30 seconds, the previous one is put
#  back. Same layout as Noorcom Computers' deploy-electronics.sh.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail
shopt -s inherit_errexit
# Start clean whatever the shell had loaded (NODE_ENV=production makes npm skip build tools).
unset NODE_ENV NPM_CONFIG_PRODUCTION npm_config_production NPM_CONFIG_OMIT npm_config_omit

BASE=/var/www/noorcom-branding
REPO="$BASE/repo"
RELEASES="$BASE/releases"
CURRENT="$BASE/current"
ENV_DIR=/etc/noorcom-branding
ENV_WEB="$ENV_DIR/web.env"
HOSTS_ENV="$ENV_DIR/hosts.env"
RUN_AS=noorcom-branding
UNIT=noorcom-branding-web
PORT=4301
KEEP=5

log() { printf '[deploy] %s\n' "$*" >&2; }
die() { printf '[deploy] FAILED: %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "run as root"

previous_release() {
  local now; now=$(readlink -f "$CURRENT" 2>/dev/null || true)
  ls -1dt "$RELEASES"/*/ 2>/dev/null | sed 's#/$##' | while read -r r; do [[ $r != "$now" ]] && { echo "$r"; break; }; done
}

switch_to() {
  local release=$1
  ln -sfn "$release" "$CURRENT.next"
  mv -Tf "$CURRENT.next" "$CURRENT"
  systemctl restart "$UNIT"
}

healthy() {
  local i
  for i in $(seq 1 30); do
    if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/" && curl -fsS -o /dev/null "http://127.0.0.1:$PORT/robots.txt"; then
      return 0
    fi
    sleep 1
  done
  return 1
}

install() {
  log "first-time install"
  id -u "$RUN_AS" >/dev/null 2>&1 || useradd --system --home "$BASE" --shell /usr/sbin/nologin "$RUN_AS"
  mkdir -p "$RELEASES" "$ENV_DIR" /var/www/letsencrypt
  [[ -d $REPO/.git ]] || die "clone the repository into $REPO first (docs/RUNBOOK.md)"
  for f in web.env hosts.env; do
    [[ -e $ENV_DIR/$f ]] || { cp "$REPO/deploy/env/$f.example" "$ENV_DIR/$f"; log "wrote $ENV_DIR/$f from the example: fill it in, then run --install again"; }
  done
  chown root:"$RUN_AS" "$ENV_WEB" && chmod 640 "$ENV_WEB"
  chmod 644 "$HOSTS_ENV"
  # shellcheck source=/dev/null
  . "$HOSTS_ENV"
  [[ ${SITE_HOST:-} && $SITE_HOST != '<SITE_HOST>' ]] || die "set SITE_HOST and WWW_HOST in $HOSTS_ENV"
  cp "$REPO/deploy/systemd/$UNIT.service" /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable "$UNIT"
  sed -e "s/WWW_HOST/$WWW_HOST/g" -e "s/SITE_HOST/$SITE_HOST/g" "$REPO/deploy/nginx/noorcom-branding.conf" > /etc/nginx/sites-available/noorcom-branding
  ln -sfn /etc/nginx/sites-available/noorcom-branding /etc/nginx/sites-enabled/noorcom-branding
  if [[ -d /etc/letsencrypt/live/$SITE_HOST ]]; then
    nginx -t && systemctl reload nginx
  else
    log "no certificate yet: run  certbot certonly --webroot -w /var/www/letsencrypt -d $SITE_HOST -d $WWW_HOST  then  nginx -t && systemctl reload nginx"
  fi
  log "installed. Now run deploy-branding.sh to build the first release."
}

rollback() {
  local prev; prev=$(previous_release)
  [[ -n $prev ]] || die "no previous release to go back to"
  log "rolling back to $(basename "$prev")"
  switch_to "$prev"
  healthy || die "the previous release does not answer either: check journalctl -u $UNIT"
  log "live: $(basename "$prev")"
}

deploy() {
  [[ -r $ENV_WEB ]] || die "$ENV_WEB is missing: run --install"
  # The site's public address is baked in at build time.
  local site_url; site_url=$(grep -E '^NEXT_PUBLIC_SITE_URL=' "$ENV_WEB" | cut -d= -f2-)
  [[ $site_url == https://* ]] || die "set NEXT_PUBLIC_SITE_URL in $ENV_WEB"

  git -C "$REPO" fetch --quiet origin main
  local commit; commit=$(git -C "$REPO" rev-parse --short origin/main)
  local release="$RELEASES/$(date +%Y%m%d-%H%M%S)-$commit"
  local build; build=$(mktemp -d /tmp/noorcom-branding-build.XXXXXX)
  trap 'rm -rf "$build"' EXIT

  log "building $commit"
  git -C "$REPO" archive origin/main | tar -x -C "$build"
  (cd "$build" && npm ci --no-audit --no-fund && NEXT_PUBLIC_SITE_URL="$site_url" npm run build) || die "build failed; nothing was changed"

  # The standalone server, plus the static files and public folder it doesn't copy itself.
  mkdir -p "$release"
  cp -a "$build/.next/standalone/." "$release/"
  mkdir -p "$release/.next"
  cp -a "$build/.next/static" "$release/.next/static"
  cp -a "$build/public" "$release/public"
  mkdir -p "$release/.next/cache"
  chown -R "$RUN_AS:$RUN_AS" "$release"

  local prev; prev=$(readlink -f "$CURRENT" 2>/dev/null || true)
  log "switching to $(basename "$release")"
  switch_to "$release"
  if ! healthy; then
    if [[ -n $prev ]]; then
      log "the new release does not answer; putting $(basename "$prev") back"
      switch_to "$prev"
    fi
    die "release $(basename "$release") did not start: check journalctl -u $UNIT"
  fi

  # Keep the newest $KEEP releases.
  ls -1dt "$RELEASES"/*/ | tail -n +$((KEEP + 1)) | xargs -r rm -rf
  log "live: $(basename "$release")"
}

case "${1:-}" in
  --install) install ;;
  --rollback) rollback ;;
  '') deploy ;;
  *) die "unknown option $1 (use --install or --rollback)" ;;
esac
