#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  deploy-branding.sh  -  build and switch a release of the Noorcom Branding website
# ───────────────────────────────────────────────────────────────────────────
#  docs/VPS_BRANDING.md. Run as root on the VPS:
#
#    deploy-branding.sh                 build the latest main and switch to it
#    deploy-branding.sh --rollback      switch back to the previous release
#    deploy-branding.sh --install       first time (and after a host change): user, folders,
#                                       env files, service, nginx site
#
#  A release is built completely before anything changes; the switch is one rename of the
#  `current` link; if the new release doesn't answer within 30 seconds, the previous one is put
#  back. Same pattern as deploy-electronics.sh on the same box, with its lessons from 1 Oct 2026.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail
# Without this, bash ignores failures inside $( ... ): a failed build could go on and switch.
shopt -s inherit_errexit

BASE=/var/www/noorcom-branding
REPO="$BASE/repo"

# First fetch the latest main and run THAT version of this script, from a private copy: a deploy
# always uses the newest deploy logic, and bash never runs a file that changed underneath it.
if [[ -z ${NB_DEPLOY_COPY:-} ]]; then
  if [[ ${1:-} != --rollback && -d $REPO/.git ]]; then
    git -C "$REPO" fetch --quiet origin main
    git -C "$REPO" checkout --quiet --detach origin/main
  fi
  copy=$(mktemp /tmp/deploy-branding.XXXXXX)
  cp "$REPO/deploy/scripts/deploy-branding.sh" "$copy"
  NB_DEPLOY_COPY="$copy" exec bash "$copy" "$@"
fi
trap 'rm -f "${NB_DEPLOY_COPY:-}"' EXIT
# Start clean whatever the shell had loaded (NODE_ENV=production makes npm skip build tools).
unset NODE_ENV NPM_CONFIG_PRODUCTION npm_config_production NPM_CONFIG_OMIT npm_config_omit

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

unit_installed() { systemctl cat "$UNIT.service" >/dev/null 2>&1; }

switch_to() {
  ln -sfn "$1" "$CURRENT.new"
  mv -T "$CURRENT.new" "$CURRENT"
  if unit_installed; then systemctl restart "$UNIT"; fi
}

healthy() {
  for _ in $(seq 1 30); do
    if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/" && curl -fsS -o /dev/null "http://127.0.0.1:$PORT/robots.txt"; then
      return 0
    fi
    sleep 1
  done
  return 1
}

install_system() {
  log "install"
  # The user and folders as VPS_LAYOUT.md (Noorcom Hosting) section 4 makes them for every project.
  id -u "$RUN_AS" >/dev/null 2>&1 || adduser --system --group --no-create-home --home "/var/lib/$RUN_AS" "$RUN_AS"
  install -d -o root -g root -m 755 "$BASE" "$RELEASES"
  install -d -o root -g "$RUN_AS" -m 750 "$ENV_DIR"
  install -d -o "$RUN_AS" -g "$RUN_AS" -m 750 "/var/lib/$RUN_AS" "/var/backups/$RUN_AS"
  [[ -d /var/www/letsencrypt ]] || install -d -o root -g root -m 755 /var/www/letsencrypt
  [[ -d $REPO/.git ]] || die "clone the repository into $REPO first (docs/VPS_BRANDING.md section 5)"
  local missing=0
  [[ -e $ENV_WEB ]] || { install -m 640 -g "$RUN_AS" "$REPO/deploy/env/web.env.example" "$ENV_WEB"; missing=1; }
  [[ -e $HOSTS_ENV ]] || { install -m 644 "$REPO/deploy/env/hosts.env.example" "$HOSTS_ENV"; missing=1; }
  chown root:"$RUN_AS" "$ENV_WEB" && chmod 640 "$ENV_WEB"
  ((missing == 0)) || die "wrote $ENV_WEB and $HOSTS_ENV from the examples: fill them in, then run --install again"
  # shellcheck source=/dev/null
  . "$HOSTS_ENV"
  [[ ${SITE_HOST:-} && $SITE_HOST != '<'* ]] || die "set SITE_HOST in $HOSTS_ENV"

  cp "$REPO/deploy/systemd/$UNIT.service" /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable "$UNIT"

  # The box is shared: a site that points at a certificate that doesn't exist yet breaks
  # `nginx -t` for every project. Get the certificate first (through the box's catch-all on
  # port 80), and only then enable the site.
  if [[ ! -d /etc/letsencrypt/live/$SITE_HOST ]]; then
    die "no certificate for $SITE_HOST yet: run  certbot certonly --webroot -w /var/www/letsencrypt -d $SITE_HOST${WWW_HOST:+ -d $WWW_HOST}  then --install again"
  fi
  # The www redirect only on the live site (WWW_HOST set, and in the certificate).
  local edits=(-e '/# WWW-BEGIN/,/# WWW-END/d')
  if [[ -n ${WWW_HOST:-} ]]; then
    edits=(-e "s/WWW_HOST/$WWW_HOST/g" -e '/# WWW-BEGIN/d' -e '/# WWW-END/d')
  fi
  # Staging: an X-Robots-Tag keeps it out of search results.
  if [[ ${NOINDEX:-} == yes ]]; then
    edits+=(-e '/# NOINDEX-BEGIN/d' -e '/# NOINDEX-END/d')
  else
    edits+=(-e '/# NOINDEX-BEGIN/,/# NOINDEX-END/d')
  fi
  local site=/etc/nginx/sites-available/noorcom-branding.conf
  [[ -e $site ]] && cp "$site" "$site.bak"
  sed "${edits[@]}" -e "s/SITE_HOST/$SITE_HOST/g" "$REPO/deploy/nginx/noorcom-branding.conf" > "$site"
  ln -sfn "$site" /etc/nginx/sites-enabled/noorcom-branding.conf
  if ! nginx -t; then
    # Put back what was there (or nothing), so every other site on the box keeps working.
    if [[ -e $site.bak ]]; then mv "$site.bak" "$site"; else rm -f /etc/nginx/sites-enabled/noorcom-branding.conf "$site"; fi
    die "nginx -t failed with the new site: the previous one was put back, nothing else changed"
  fi
  rm -f "$site.bak"
  systemctl reload nginx
  if [[ -e $CURRENT ]]; then systemctl restart "$UNIT"; fi
  log "installed. Deploy with: bash $REPO/deploy/scripts/deploy-branding.sh"
}

rollback() {
  local prev; prev=$(previous_release)
  [[ -n $prev ]] || die "no previous release to go back to"
  log "rolling back to $(basename "$prev")"
  switch_to "$prev"
  healthy || die "the previous release does not answer either: check journalctl -u $UNIT"
  log "live: $(basename "$prev")"
}

build_release() {
  local commit name release
  commit=$(git -C "$REPO" rev-parse --short HEAD)
  name="$(date +%Y%m%d-%H%M)-$commit"
  release="$RELEASES/$name"
  [[ -e $release ]] && die "$release already exists"
  # Global, not local: the EXIT trap runs after this function has returned. /var/tmp, not /tmp:
  # the build needs more room than a tmpfs may have.
  build=$(mktemp -d /var/tmp/nb-build.XXXXXX)
  trap 'rm -rf "${build:-}"; rm -f "${NB_DEPLOY_COPY:-}"' EXIT
  log "building $name"

  git -C "$REPO" archive HEAD | tar -x -C "$build"
  # NEXT_PUBLIC_* are baked in at build time, so web.env is loaded for the build.
  (cd "$build" && npm ci --include=dev --no-audit --no-fund && set -a && . "$ENV_WEB" && set +a && npx next build)

  # The standalone server, plus the static files and public folder it doesn't copy itself.
  mkdir -p "$release"
  cp -a "$build/.next/standalone/." "$release/"
  mkdir -p "$release/.next/cache"
  cp -a "$build/.next/static" "$release/.next/static"
  cp -a "$build/public" "$release/public"
  # The service reads the release and writes only next/image's cache.
  chown -R root:"$RUN_AS" "$release"
  chmod -R g+rX,o-rwx "$release"
  chown -R "$RUN_AS:$RUN_AS" "$release/.next/cache"
  # The release path goes back on descriptor 3; everything else above went to the terminal.
  echo "$release" >&3
}

deploy() {
  [[ -r $ENV_WEB ]] || die "$ENV_WEB is missing: run --install"
  local site_url; site_url=$(grep -E '^NEXT_PUBLIC_SITE_URL=' "$ENV_WEB" | cut -d= -f2-)
  [[ $site_url == https://* && $site_url != *'<'* ]] || die "set NEXT_PUBLIC_SITE_URL in $ENV_WEB"

  local prev release
  prev=$(readlink -f "$CURRENT" 2>/dev/null || true)
  release=$(build_release 3>&1 1>&2)
  for part in server.js .next/static public; do
    [[ -e $release/$part ]] || die "$(basename "$release") has no $part: not switching"
  done

  log "switching to $(basename "$release")"
  switch_to "$release"
  if ! unit_installed; then
    log "release in place; the service isn't installed yet: run --install"
    return 0
  fi
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
  --install) install_system ;;
  --rollback) rollback ;;
  '') deploy ;;
  *) die "unknown option $1 (use --install or --rollback)" ;;
esac
