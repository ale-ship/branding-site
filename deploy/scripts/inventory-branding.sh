#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  inventory-branding.sh  -  Phase 0 on the new VPS: what is already there, read only
# ───────────────────────────────────────────────────────────────────────────
#  docs/VPS_BRANDING.md, section 0. Run as root on the VPS and paste the whole output back:
#
#    bash inventory-branding.sh 2>&1 | tee /root/inventory-branding.txt
#
#  It changes nothing: no installs, no restarts, no writes outside its own output. It prints no
#  secrets: env files are listed by name and size only, and nginx files only by their server
#  names, listens and proxy targets.
# ═══════════════════════════════════════════════════════════════════════════
set -uo pipefail

section() { printf '\n===== %s =====\n' "$1"; }
have() { command -v "$1" >/dev/null 2>&1; }

section 'Machine'
hostnamectl 2>/dev/null | grep -E 'hostname|Operating System|Kernel|Virtualization' || uname -a
uptime
free -h
nproc
df -h -x tmpfs -x devtmpfs -x squashfs
timedatectl 2>/dev/null | grep -E 'Time zone|synchronized'

section 'Updates and security'
[[ -f /var/run/reboot-required ]] && echo 'A reboot is pending' || echo 'No reboot pending'
apt list --upgradable 2>/dev/null | tail -n +2 | wc -l | xargs echo 'Upgradable packages:'
have ufw && ufw status verbose
have fail2ban-client && fail2ban-client status
grep -E '^\s*(PermitRootLogin|PasswordAuthentication|Port)\b' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf 2>/dev/null
unattended=$(dpkg -l unattended-upgrades 2>/dev/null | grep -c '^ii'); echo "unattended-upgrades installed: $unattended"

section 'Listening ports'
ss -tlnp

section 'Software'
for c in node npm pnpm psql postgres redis-server redis-cli nginx certbot git pm2 docker chromium chromium-browser; do
  if have "$c"; then printf '%-16s %s\n' "$c" "$("$c" --version 2>&1 | head -1)"; else printf '%-16s -\n' "$c"; fi
done
have nginx && nginx -v 2>&1

section 'Services running'
systemctl list-units --type=service --state=running --no-pager --no-legend | awk '{print $1}'

section 'Services we would add (should all be absent)'
systemctl list-unit-files 'noorcom-branding*' --no-pager --no-legend || true

section 'Users with a login shell or a home under /var/www'
awk -F: '$7 !~ /(nologin|false)$/ || $6 ~ /^\/var\/www/ {print $1, $6, $7}' /etc/passwd

section 'nginx sites'
for f in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf; do
  [[ -e $f ]] || continue
  echo "--- $f -> $(readlink -f "$f")"
  grep -E '^\s*(listen|server_name|proxy_pass|root)\b' "$f" | sed 's/^\s*/  /'
done
have nginx && nginx -t 2>&1 | tail -2

section 'Certificates'
have certbot && certbot certificates 2>/dev/null | grep -E 'Certificate Name|Domains|Expiry'

section 'Postgres'
if have psql; then
  sudo -u postgres psql -Atc 'SELECT version();' 2>&1
  echo 'Databases:'; sudo -u postgres psql -Atc "SELECT datname FROM pg_database WHERE NOT datistemplate;" 2>&1
  echo 'Roles:'; sudo -u postgres psql -Atc 'SELECT rolname FROM pg_roles WHERE rolname !~ $$^pg_$$;' 2>&1
  sudo -u postgres psql -Atc 'SHOW listen_addresses;' 2>&1 | xargs echo 'listen_addresses:'
fi

section 'Redis'
if have redis-cli; then
  redis-cli ping 2>&1 | head -1
  redis-cli ACL USERS 2>&1 | head -20
  grep -E '^\s*(bind|port|requirepass|aclfile|maxmemory)\b' /etc/redis/redis.conf 2>/dev/null | sed 's/requirepass .*/requirepass <set>/'
fi

section 'Folders we would use (should all be absent)'
ls -ld /var/www/* /etc/noorcom-branding /var/lib/noorcom-branding /var/backups/noorcom-branding 2>&1

section 'Env files elsewhere (names and sizes only)'
find /etc /var/www /opt /srv /home -maxdepth 4 \( -name '*.env' -o -name '.env' \) 2>/dev/null | xargs -r ls -l 2>/dev/null

section 'Cron'
crontab -l 2>/dev/null; ls /etc/cron.d 2>/dev/null

section 'Done'
echo 'Nothing was changed. Paste everything above back.'
