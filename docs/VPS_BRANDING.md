# Noorcom Branding on the Contabo VPS

Written 7 Oct 2026. The branding part of the shared Contabo box, done the same way as Noorcom
Computers (the electronics website) on the same box: its own system user, database, Redis user
and port, releases with a `current` link and rollback, and secrets only on the box. Read
`docs/RUNBOOK.md` first; the backend's design is `docs/BACKEND_RUNBOOK.md`.

The box itself (updates, firewall, fail2ban, Postgres, Redis, nginx, certbot, Node) was set up
once for Noorcom Hosting and is already shared by Noorcom Computers. **Do not redo any of it.**
This document covers only what branding adds.

Every block runs as `root` in an SSH session, tag `[VPS]`. Anything written `<LIKE_THIS>` is a
placeholder. Never paste a password, key or token into chat, a ticket or this repository.

---

## 1. Names

| Resource | Value |
|---|---|
| The box | Contabo `vmi3615768`, **144.91.76.57**. 11 GiB memory, 6 CPUs; Node 24, PostgreSQL 17, Redis 7.0, nginx 1.24 (1 Oct 2026) |
| Neighbours | Noorcom Hosting (Redis `nn`), Noorcom Computers: API `4200`, storefront `4201`, Redis `ne` |
| Domains | Staging: `staging.noorcombranding.co.ke`. Live: `noorcombranding.co.ke`, `www.noorcombranding.co.ke` (redirects to the bare name) |
| System user | `noorcom-branding` |
| Site (Next.js) | `127.0.0.1:4301`, unit `noorcom-branding-web` |
| API and worker (from step B1) | `127.0.0.1:4300`, units `noorcom-branding-api`, `noorcom-branding-worker` |
| Postgres | role and database `noorcom_branding` |
| Redis | user `nb`, keys `nb:*`, BullMQ prefix `nb:bull` |
| Env files | `/etc/noorcom-branding/web.env` (site), `hosts.env` (names), `api.env` (API and worker, from B1); `root:noorcom-branding` 640 (`hosts.env` 644) |
| Files | `/var/lib/noorcom-branding/` (from B1) |
| Backups | `/var/backups/noorcom-branding/` (from B1) |
| nginx | `/etc/nginx/sites-available/noorcom-branding.conf` |
| Repository on the box | `/var/www/noorcom-branding/repo`, cloned from `Noorcom-Network-NNL/noorcom-branding` with a read-only deploy key |

### 1.1 The staging name

The domain's DNS is on Namecheap (nameservers `rs38a`/`rs38b.registrar-servers.com`). Today `@`
points at Lovable (199.36.158.100), which still serves the old site. Add **one A record**:

| Host | Type | Value |
|---|---|---|
| `staging` | A | `144.91.76.57` |

Leave `@`, `www`, `mail`, MX and every TXT record alone: they carry the live site and email.
Check from anywhere: `nslookup staging.noorcombranding.co.ke` answers `144.91.76.57`.

Staging sends `X-Robots-Tag: noindex` (`NOINDEX=yes` in `hosts.env`), so search engines don't
index it as a copy of the future live site.

### 1.2 Memory

`[VPS]`
```bash
free -h; nproc
```

The site alone needs little (a Next.js server, and about 1 GB while building). From B1 the API, the
worker and Chromium for PDFs follow: plan on 2 GB free for branding.

---

## 2. Folders

```text
/var/www/noorcom-branding/
├── repo/                        git clone of the repository (detached at origin/main by each deploy)
├── releases/
│   └── 20261008-1000-f8971ef/   Next.js standalone output: server.js, .next/static, public
└── current -> releases/20261008-1000-f8971ef
```

Releases belong to `root:noorcom-branding` and are read only to the service; it writes only
`.next/cache` (next/image's optimised copies). Builds happen in `/var/tmp`, then the switch.

---

## 3. Access to the repository: a deploy key

The repository is private. The box gets its own **read-only deploy key**, never copied off it
(the same way electronics clones its repository).

`[VPS]`
```bash
ssh-keygen -t ed25519 -N "" -C "vps deploy noorcom-branding" -f /root/.ssh/noorcom_branding_deploy
cat >> /root/.ssh/config <<'EOF'

Host github-noorcom-branding
  HostName github.com
  User git
  IdentityFile /root/.ssh/noorcom_branding_deploy
  IdentitiesOnly yes
EOF
cat /root/.ssh/noorcom_branding_deploy.pub
```

On GitHub: `Noorcom-Network-NNL/noorcom-branding`, Settings, Deploy keys, Add deploy key: title
"VPS 144.91.76.57", paste the `.pub` line, **leave "Allow write access" off**. Then:

`[VPS]`
```bash
ssh -T git@github-noorcom-branding
```

It answers "Hi Noorcom-Network-NNL/noorcom-branding! You've successfully authenticated".

---

## 4. The env files

`deploy-branding.sh --install` writes them from `deploy/env/*.example` the first time and stops so
they can be checked:

- `/etc/noorcom-branding/hosts.env`: `SITE_HOST=staging.noorcombranding.co.ke`, `NOINDEX=yes`, no
  `WWW_HOST` on staging.
- `/etc/noorcom-branding/web.env`: `PORT=4301`, `HOSTNAME=127.0.0.1`,
  `NEXT_PUBLIC_SITE_URL=https://staging.noorcombranding.co.ke`. `NEXT_PUBLIC_*` are baked in at
  build time: a change needs a deploy, not a restart.
- From B1, `/etc/noorcom-branding/api.env` (`docs/BACKEND_RUNBOOK.md` section 11), secrets made on
  the box with `openssl rand -hex 32` and never shown, as electronics did.

---

## 5. First deploy

In order. Each `--install` is safe to run again.

`[VPS]`
```bash
git clone git@github-noorcom-branding:Noorcom-Network-NNL/noorcom-branding.git /var/www/noorcom-branding/repo
bash /var/www/noorcom-branding/repo/deploy/scripts/deploy-branding.sh --install
```

The first run creates the user and folders, writes `hosts.env` and `web.env`, and stops. Check
them (section 4), then run `--install` again: it installs the service and stops again, because
there is no certificate yet. **The certificate comes before the nginx site**: a site that points at
a missing certificate fails `nginx -t` for every project on the box.

`[VPS]`
```bash
certbot certonly --webroot -w /var/www/letsencrypt -d staging.noorcombranding.co.ke
bash /var/www/noorcom-branding/repo/deploy/scripts/deploy-branding.sh --install
bash /var/www/noorcom-branding/repo/deploy/scripts/deploy-branding.sh
```

The certificate comes through the box's catch-all on port 80, as electronics' did. The last
command builds the first release and ends with `[deploy] live: <release>`. Then, from anywhere:

```bash
bash deploy/scripts/smoke-branding.sh https://staging.noorcombranding.co.ke
```

---

## 6. nginx

`deploy/nginx/noorcom-branding.conf`, written by `--install` with the names from `hosts.env`:
port 80 to HTTPS (and the ACME challenge), the site proxied to `127.0.0.1:4301`, a year's cache on
`/_next/static`, gzip, HSTS. The www block is kept only when `WWW_HOST` is set (live), the
`X-Robots-Tag` only when `NOINDEX=yes` (staging). If `nginx -t` fails with the new file, the
previous one is put back. The other security headers come from the site (`next.config.ts`).

From B1, `/api/` goes to the API on 4300 (`docs/BACKEND_RUNBOOK.md` section 10), with Absa's IP
ranges allowed on the callback paths.

---

## 7. Every later deploy

The box builds from `origin/main` of the organisation repository: push there first.

`[VPS]`
```bash
bash /var/www/noorcom-branding/repo/deploy/scripts/deploy-branding.sh
```

Keep the SSH window open until the `live:` line (a closed session stops the deploy; that is safe,
because the switch is the last step: run it again). On a shaky connection:

`[VPS]`
```bash
nohup bash /var/www/noorcom-branding/repo/deploy/scripts/deploy-branding.sh > /root/deploy-branding.log 2>&1 &
sleep 2; tail -f /root/deploy-branding.log      # Ctrl+C only stops the watching
```

Back one release: `deploy-branding.sh --rollback`. What the script does:

1. `git fetch` and a detached checkout of `origin/main`, then it runs **that** version of itself
   from a private copy, so a deploy always uses the newest deploy logic. It clears `NODE_ENV` and
   npm's production settings first.
2. Builds a new release `YYYYMMDD-HHMM-<commit>` in `/var/tmp`: `npm ci --include=dev`, `web.env`
   loaded, `next build` (standalone); copies `server.js`, `.next/static` and `public`.
3. Refuses to switch to a release missing one of them.
4. Switches `current` in one step and restarts `noorcom-branding-web`.
5. Waits up to 30 s for `/` and `/robots.txt` on 4301; if not, puts the previous release back.
6. Keeps the newest five releases.

---

## 8. Postgres and Redis (before step B1)

The database work happens here, on the box (owner, 7 Oct 2026); a local copy on the office machine
is only for running the backend's tests (`docs/BACKEND_RUNBOOK.md`, "Setting up Postgres and
Redis on a development machine").

`[VPS]`
```bash
openssl rand -hex 24    # keep it as <NB_DB_PASSWORD> in the password manager
```

`[VPS]`
```bash
sudo -u postgres psql -c "CREATE ROLE noorcom_branding LOGIN PASSWORD '<NB_DB_PASSWORD>'"
sudo -u postgres createdb -O noorcom_branding noorcom_branding
sudo -u postgres psql -c "REVOKE CONNECT ON DATABASE noorcom_branding FROM PUBLIC"
sudo -u postgres psql -c "ALTER ROLE noorcom_branding SET statement_timeout = '15s'"
sudo -u postgres psql -c "ALTER ROLE noorcom_branding SET idle_in_transaction_session_timeout = '30s'"
```

For Redis, add the user `nb` exactly as `ne` was added (Noorcom Hosting's `VPS_LAYOUT.md`, section
6): the same rules as `nn` and `ne`, key pattern `~nb:*`, `<NB_REDIS_PASSWORD>` from
`openssl rand -hex 24`; applied live with `ACL SETUSER` **and** written into `redis.conf` (back it
up first, e.g. `redis.conf.bak-before-nb`), so it survives a restart without restarting Redis now.

From B1: the API and worker units, `api.env`, migrations in the deploy, and a nightly backup
(`pg_dump -Fc` to `/var/backups/noorcom-branding/`, 14 days, a timer at 02:30 like
electronics') with a restore check. `docs/BACKEND_RUNBOOK.md` section 10 has the plan.

---

## 9. Cutover to noorcombranding.co.ke

After the launch checklist in `docs/RUNBOOK.md`:

1. A day before: TTL 300 on the `@` and `www` records.
2. On the day, **DNS first** (the certificate is issued over HTTP): `@` and `www` A records to
   `144.91.76.57`. Leave `mail`, MX, SPF, DKIM, DMARC and `staging` alone. Wait until
   `nslookup noorcombranding.co.ke` and `www.` both answer `144.91.76.57`.
3. `certbot certonly --webroot -w /var/www/letsencrypt -d noorcombranding.co.ke -d www.noorcombranding.co.ke`.
4. `hosts.env`: `SITE_HOST=noorcombranding.co.ke`, `WWW_HOST=www.noorcombranding.co.ke`, remove
   `NOINDEX`. `web.env`: `NEXT_PUBLIC_SITE_URL=https://noorcombranding.co.ke`. Then `--install`
   and a deploy (the site bakes its address in). Keep the gap between steps 2 and 4 short.
5. `smoke-branding.sh https://noorcombranding.co.ke`, then the rest of the launch checklist (Search
   Console, Google Business Profile, a WhatsApp link preview). Keep the Lovable project a week.

---

## 10. Gate

| Check | Result |
|---|---|
| `ssh -T git@github-noorcom-branding` authenticates, read only | |
| `nslookup staging.noorcombranding.co.ke` answers 144.91.76.57 | |
| `/etc/noorcom-branding/web.env` is `root:noorcom-branding` 640 | |
| `ss -ltnp` shows 4301 on `127.0.0.1` only | |
| `nginx -t` passes with every project's sites enabled | |
| `smoke-branding.sh https://staging.noorcombranding.co.ke`: every line `ok` | |
| `curl -sI https://staging.noorcombranding.co.ke` shows `X-Robots-Tag: noindex, nofollow` | |
| `npm run a11y`, `devices`, `menu` with `BASE=https://staging.noorcombranding.co.ke` pass | |
| A deploy, then `--rollback`, then a deploy again all complete | |
| Electronics still answers: `https://staging.noorcom.co.ke` and its admin load | |
| (B1) `psql` as `noorcom_branding` connects to its own database, refused on `noorcom_electronics` | |
| (B1) Redis user `nb` gets `OK` on `nb:probe` and `NOPERM` on `ne:probe` | |
