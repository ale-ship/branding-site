#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  deploy-branding.sh  -  build and switch a release of Noorcom Branding: site, API, worker, back office
# ───────────────────────────────────────────────────────────────────────────
#  docs/VPS_BRANDING.md. Run as root on the VPS:
#
#    deploy-branding.sh                 build the latest main and switch to it
#    deploy-branding.sh --rollback      switch back to the previous release (the database stays)
#    deploy-branding.sh --install       first time (and after a host change): user, folders,
#                                       env files, services, backup timer, nginx site
#
#  A release (releases/<date>-<commit>/{web,api,admin}) is built completely before anything changes:
#  the API's production packages, the back office, a database backup, the migrations and seeds, then
#  the site, built against the NEW API started for a moment on a spare port (the site reads its pages
#  from the API while it builds). The switch is one rename of the `current` link and a restart of
#  the three services; if the API (with the new build id) or the site doesn't answer within 30
#  seconds, the previous release is put back. Migrations are not undone by a rollback: they must
#  keep the previous release working (add, don't rename or drop, in the same deploy).
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
ENV_API="$ENV_DIR/api.env"
HOSTS_ENV="$ENV_DIR/hosts.env"
DATA=/var/lib/noorcom-branding
BACKUPS=/var/backups/noorcom-branding
RUN_AS=noorcom-branding
UNITS=(noorcom-branding-api noorcom-branding-worker noorcom-branding-web)
WEB_PORT=4301
API_PORT=4300
# The new API answers here while the site builds; nothing else may use it (the inventory checks).
BUILD_API_PORT=4302
KEEP=5

log() { printf '[deploy] %s\n' "$*" >&2; }
die() { printf '[deploy] FAILED: %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "run as root"

# An env file's settings as NAME=value words for `env`, read line by line rather than sourced, so
# a value with spaces or <> (MAIL_FROM) is taken as it is, as systemd's EnvironmentFile takes it.
env_of() {
  local -n into=$2
  into=()
  local line
  while IFS= read -r line || [[ -n $line ]]; do
    line=${line%$'\r'}
    [[ $line =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] && into+=("$line")
  done < "$1"
  return 0
}

# Runs as the service user. setpriv replaces itself with the command (runuser would stay in
# between), so a background job's $! is the command itself and can be stopped.
AS_SERVICE=(setpriv --reuid="$RUN_AS" --regid="$RUN_AS" --init-groups)

# A setting from an env file (empty when unset).
setting() { grep -E "^$2=" "$1" | tail -1 | cut -d= -f2- || true; }

previous_release() {
  local now; now=$(readlink -f "$CURRENT" 2>/dev/null || true)
  ls -1dt "$RELEASES"/*/ 2>/dev/null | sed 's#/$##' | while read -r r; do [[ $r != "$now" ]] && { echo "$r"; break; }; done
}

units_installed() { systemctl cat noorcom-branding-api.service >/dev/null 2>&1; }

switch_to() {
  ln -sfn "$1" "$CURRENT.new"
  mv -T "$CURRENT.new" "$CURRENT"
  if units_installed; then systemctl restart "${UNITS[@]}"; fi
}

api_healthy() {
  local port=$1 build=$2 body
  for _ in $(seq 1 30); do
    body=$(curl -fsS "http://127.0.0.1:$port/api/health" 2>/dev/null || true)
    if [[ $body == *'"status":"ok"'* && $body == *"\"build\":\"$build\""* ]]; then return 0; fi
    sleep 1
  done
  log "API on $port: ${body:-no answer}"
  return 1
}

web_healthy() {
  for _ in $(seq 1 30); do
    if curl -fsS -o /dev/null "http://127.0.0.1:$WEB_PORT/" && curl -fsS -o /dev/null "http://127.0.0.1:$WEB_PORT/robots.txt"; then
      return 0
    fi
    sleep 1
  done
  return 1
}

# Fills an env file from its example the first time; returns 1 when it had to.
seed_env() {
  local file=$1 example=$2 mode=$3
  [[ -e $file ]] && return 0
  install -m "$mode" -o root -g "$RUN_AS" "$example" "$file"
  return 1
}

install_system() {
  log "install"
  id -u "$RUN_AS" >/dev/null 2>&1 || adduser --system --group --no-create-home --home "$DATA" "$RUN_AS"
  install -d -o root -g root -m 755 "$BASE" "$RELEASES"
  install -d -o root -g "$RUN_AS" -m 750 "$ENV_DIR"
  install -d -o "$RUN_AS" -g "$RUN_AS" -m 750 "$DATA" "$DATA/storage" "$DATA/mail-outbox" "$DATA/whatsapp-outbox"
  install -d -o root -g root -m 700 "$BACKUPS"
  [[ -d /var/www/letsencrypt ]] || install -d -o root -g root -m 755 /var/www/letsencrypt
  [[ -d $REPO/.git ]] || die "clone the repository into $REPO first (docs/VPS_BRANDING.md section 5)"

  local missing=0
  seed_env "$ENV_WEB" "$REPO/deploy/env/web.env.example" 640 || missing=1
  seed_env "$ENV_API" "$REPO/deploy/env/api.env.example" 640 || missing=1
  seed_env "$HOSTS_ENV" "$REPO/deploy/env/hosts.env.example" 644 || missing=1
  chown root:"$RUN_AS" "$ENV_WEB" "$ENV_API" && chmod 640 "$ENV_WEB" "$ENV_API"
  ((missing == 0)) || die "wrote the missing env files in $ENV_DIR from the examples: fill them in (section 4), then run --install again"
  local f
  for f in "$ENV_WEB" "$ENV_API" "$HOSTS_ENV"; do
    if grep -nE '^[A-Z_]+=.*<' "$f" | grep -v '^.*MAIL_FROM=' >&2; then die "$f still has placeholders (above)"; fi
  done
  local site_host www_host noindex
  site_host=$(setting "$HOSTS_ENV" SITE_HOST); www_host=$(setting "$HOSTS_ENV" WWW_HOST); noindex=$(setting "$HOSTS_ENV" NOINDEX)
  [[ -n $site_host ]] || die "set SITE_HOST in $HOSTS_ENV"

  local u
  for u in "${UNITS[@]}" noorcom-branding-backup; do cp "$REPO/deploy/systemd/$u.service" /etc/systemd/system/; done
  cp "$REPO/deploy/systemd/noorcom-branding-backup.timer" /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable "${UNITS[@]}"
  systemctl enable --now noorcom-branding-backup.timer

  # The box is shared: a site that points at a certificate that doesn't exist yet breaks
  # `nginx -t` for every project. So until the certificate exists, only a port-80 site for our
  # names (in its own file, so a live site already there keeps running) answers certbot.
  local acme=/etc/nginx/sites-available/noorcom-branding-acme.conf
  if [[ ! -d /etc/letsencrypt/live/$site_host ]]; then
    printf 'server {\n    listen 80;\n    listen [::]:80;\n    server_name %s;\n    location /.well-known/acme-challenge/ { root /var/www/letsencrypt; }\n    location / { return 404; }\n}\n' \
      "$site_host${www_host:+ $www_host}" > "$acme"
    ln -sfn "$acme" /etc/nginx/sites-enabled/noorcom-branding-acme.conf
    if ! nginx -t; then
      rm -f /etc/nginx/sites-enabled/noorcom-branding-acme.conf "$acme"
      die "nginx -t failed with the certificate site: removed it, nothing else changed"
    fi
    systemctl reload nginx
    die "no certificate for $site_host yet. Port 80 now answers for it: run
    certbot certonly --webroot -w /var/www/letsencrypt -d $site_host${www_host:+ -d $www_host}
  then --install again"
  fi
  rm -f /etc/nginx/sites-enabled/noorcom-branding-acme.conf "$acme"
  # The www redirect only on the live site (WWW_HOST set, and in the certificate).
  local edits=(-e '/# WWW-BEGIN/,/# WWW-END/d')
  if [[ -n $www_host ]]; then
    edits=(-e "s/WWW_HOST/$www_host/g" -e '/# WWW-BEGIN/d' -e '/# WWW-END/d')
  fi
  # Staging: an X-Robots-Tag keeps it out of search results.
  if [[ $noindex == yes ]]; then
    edits+=(-e '/# NOINDEX-BEGIN/d' -e '/# NOINDEX-END/d')
  else
    edits+=(-e '/# NOINDEX-BEGIN/,/# NOINDEX-END/d')
  fi
  local site=/etc/nginx/sites-available/noorcom-branding.conf
  [[ -e $site ]] && cp "$site" "$site.bak"
  sed "${edits[@]}" -e "s/SITE_HOST/$site_host/g" "$REPO/deploy/nginx/noorcom-branding.conf" > "$site"
  ln -sfn "$site" /etc/nginx/sites-enabled/noorcom-branding.conf
  if ! nginx -t; then
    # Put back what was there (or nothing), so every other site on the box keeps working.
    if [[ -e $site.bak ]]; then mv "$site.bak" "$site"; else rm -f /etc/nginx/sites-enabled/noorcom-branding.conf "$site"; fi
    die "nginx -t failed with the new site: the previous one was put back, nothing else changed"
  fi
  rm -f "$site.bak"
  systemctl reload nginx
  if [[ -e $CURRENT ]]; then systemctl restart "${UNITS[@]}"; fi
  log "installed. Deploy with: bash $REPO/deploy/scripts/deploy-branding.sh"
}

rollback() {
  local prev; prev=$(previous_release)
  [[ -n $prev ]] || die "no previous release to go back to"
  log "rolling back to $(basename "$prev") (the database is not rolled back)"
  switch_to "$prev"
  api_healthy "$API_PORT" "$(basename "$prev")" && web_healthy || die "the previous release does not answer either: check journalctl -u noorcom-branding-api -u noorcom-branding-web"
  log "live: $(basename "$prev")"
}

# Builds the release and prints its path on descriptor 3; everything else goes to the terminal.
build_release() {
  local commit name release
  commit=$(git -C "$REPO" rev-parse --short HEAD)
  name="$(date +%Y%m%d-%H%M)-$commit"
  release="$RELEASES/$name"
  [[ -e $release ]] && die "$release already exists"
  # Globals, not locals: the EXIT trap runs after this function has returned. /var/tmp, not /tmp:
  # the build needs more room than a tmpfs may have.
  build=$(mktemp -d /var/tmp/nb-build.XXXXXX)
  apibuild=$(mktemp -d /var/tmp/nb-api.XXXXXX)
  tmp_api=''
  trap 'kill "${tmp_api:-}" 2>/dev/null || true; rm -rf "${build:-}" "${apibuild:-}"; rm -f "${NB_DEPLOY_COPY:-}"' EXIT
  log "building $name"
  mkdir -p "$release"

  # 1. The API: the backend and shared/ with production packages only.
  git -C "$REPO" archive HEAD | tar -x -C "$apibuild"
  (cd "$apibuild" && npm ci --omit=dev --workspace=backend --include-workspace-root=false --no-audit --no-fund)
  mkdir -p "$release/api"
  cp -a "$apibuild/backend" "$apibuild/shared" "$apibuild/node_modules" "$apibuild/package.json" "$release/api/"
  # The workspace link, relative so it holds wherever the release is.
  ln -sfn ../../shared "$release/api/node_modules/@noorcom-branding/shared"
  rm -f "$release/api/node_modules/@noorcom-branding/backend"
  cp "$apibuild/deploy/scripts/backup-branding.sh" "$release/api/"
  echo "BUILD_ID=$name" > "$release/api/build.env"

  # 2. Everything else needs the dev packages: the back office's build, then the site's.
  git -C "$REPO" archive HEAD | tar -x -C "$build"
  (cd "$build" && npm ci --include=dev --no-audit --no-fund && npm run admin:build)
  cp -a "$build/admin/dist" "$release/admin"

  chown -R root:"$RUN_AS" "$release"
  chmod -R g+rX,o-rwx "$release"
  # nginx serves the back office's files itself.
  chmod o+x "$release"
  chmod -R o+rX "$release/admin"

  # 3. The database: a backup, then the migrations and the seeds (which add, never overwrite).
  local db_url; db_url=$(setting "$ENV_API" DATABASE_URL)
  log "backing up the database before migrating"
  pg_dump -Fc --no-owner "$db_url" -f "$BACKUPS/pre-deploy-$name.dump"
  ls -1t "$BACKUPS"/pre-deploy-*.dump 2>/dev/null | tail -n +6 | xargs -r rm -f
  log "migrations and seeds"
  local api_env web_env
  env_of "$ENV_API" api_env
  env_of "$ENV_WEB" web_env
  env -C "$release/api/backend" "${api_env[@]}" "${AS_SERVICE[@]}" node ../node_modules/knex/bin/cli.js migrate:latest
  env -C "$release/api/backend" "${api_env[@]}" "${AS_SERVICE[@]}" node ../node_modules/knex/bin/cli.js seed:run

  # 4. The new API on a spare port, for the site's build to read from.
  env -C "$release/api/backend" "${api_env[@]}" PORT="$BUILD_API_PORT" BUILD_ID="$name" "${AS_SERVICE[@]}" node src/server.js > "$build/api.log" 2>&1 &
  tmp_api=$!
  api_healthy "$BUILD_API_PORT" "$name" || { tail -20 "$build/api.log" >&2; die "the new API did not start (log above): nothing was switched"; }

  # 5. The site. NEXT_PUBLIC_* are baked in at build time, so web.env is loaded for the build.
  env -C "$build" "${web_env[@]}" API_INTERNAL_URL="http://127.0.0.1:$BUILD_API_PORT" npx next build
  kill "$tmp_api" 2>/dev/null || true
  wait "$tmp_api" 2>/dev/null || true
  tmp_api=''

  # The standalone server, plus the static files and public folder it doesn't copy itself.
  mkdir -p "$release/web"
  cp -a "$build/.next/standalone/." "$release/web/"
  mkdir -p "$release/web/.next/cache"
  cp -a "$build/.next/static" "$release/web/.next/static"
  cp -a "$build/public" "$release/web/public"
  chown -R root:"$RUN_AS" "$release/web"
  chmod -R g+rX,o-rwx "$release/web"
  # The site writes only next/image's cache.
  chown -R "$RUN_AS:$RUN_AS" "$release/web/.next/cache"
  echo "$release" >&3
}

deploy() {
  [[ -r $ENV_WEB && -r $ENV_API ]] || die "$ENV_WEB or $ENV_API is missing: run --install"
  local site_url; site_url=$(setting "$ENV_WEB" NEXT_PUBLIC_SITE_URL)
  [[ $site_url == https://* && $site_url != *'<'* ]] || die "set NEXT_PUBLIC_SITE_URL in $ENV_WEB"
  [[ $(setting "$ENV_API" DATABASE_URL) == postgres://* ]] || die "set DATABASE_URL in $ENV_API"
  if ss -ltn "sport = :$BUILD_API_PORT" | grep -q LISTEN; then die "port $BUILD_API_PORT is taken: the build needs it"; fi

  local prev release name
  prev=$(readlink -f "$CURRENT" 2>/dev/null || true)
  release=$(build_release 3>&1 1>&2)
  name=$(basename "$release")
  for part in web/server.js web/.next/static web/public api/backend/src/server.js api/build.env admin/index.html; do
    [[ -e $release/$part ]] || die "$name has no $part: not switching"
  done

  log "switching to $name"
  switch_to "$release"
  if ! units_installed; then
    log "release in place; the services aren't installed yet: run --install"
    return 0
  fi
  if ! api_healthy "$API_PORT" "$name" || ! web_healthy; then
    if [[ -n $prev ]]; then
      log "the new release does not answer; putting $(basename "$prev") back"
      switch_to "$prev"
    fi
    die "release $name did not start: check journalctl -u noorcom-branding-api -u noorcom-branding-web"
  fi

  # Keep the newest $KEEP releases.
  ls -1dt "$RELEASES"/*/ | tail -n +$((KEEP + 1)) | xargs -r rm -rf
  log "live: $name"
}

case "${1:-}" in
  --install) install_system ;;
  --rollback) rollback ;;
  '') deploy ;;
  *) die "unknown option $1 (use --install or --rollback)" ;;
esac
