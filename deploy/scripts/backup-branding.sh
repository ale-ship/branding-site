#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  backup-branding.sh  -  the branding database and stored files, nightly
# ───────────────────────────────────────────────────────────────────────────
#  docs/VPS_BRANDING.md section 8. Run as root by noorcom-branding-backup.timer (02:45), or by hand:
#
#    bash /var/www/noorcom-branding/current/api/backup-branding.sh
#
#  Writes /var/backups/noorcom-branding/db-<date>.dump (pg_dump -Fc) and files-<date>.tar.gz (the
#  photos, proofs and files under /var/lib/noorcom-branding), keeps 14 days, and checks the dump can
#  be read back. Copies off the box (R2) come with the R2 client.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

ENV_API=/etc/noorcom-branding/api.env
DEST=/var/backups/noorcom-branding
DATA=/var/lib/noorcom-branding
KEEP_DAYS=14
stamp=$(date +%Y%m%d-%H%M)

[[ $EUID -eq 0 ]] || { echo 'run as root' >&2; exit 1; }
url=$(grep -E '^DATABASE_URL=' "$ENV_API" | cut -d= -f2-)
[[ $url == postgres://* ]] || { echo "no DATABASE_URL in $ENV_API" >&2; exit 1; }

install -d -o root -g root -m 700 "$DEST"
pg_dump -Fc --no-owner "$url" -f "$DEST/db-$stamp.dump.part"
# A dump that can't be listed is no backup.
pg_restore --list "$DEST/db-$stamp.dump.part" >/dev/null
mv "$DEST/db-$stamp.dump.part" "$DEST/db-$stamp.dump"

if [[ -d $DATA ]]; then
  tar -czf "$DEST/files-$stamp.tar.gz.part" -C "$DATA" .
  mv "$DEST/files-$stamp.tar.gz.part" "$DEST/files-$stamp.tar.gz"
fi

find "$DEST" -maxdepth 1 -type f \( -name 'db-*.dump' -o -name 'files-*.tar.gz' -o -name 'pre-deploy-*.dump' \) -mtime +"$KEEP_DAYS" -delete
find "$DEST" -maxdepth 1 -name '*.part' -mmin +60 -delete
echo "backup done: $DEST/db-$stamp.dump ($(du -h "$DEST/db-$stamp.dump" | cut -f1))"
