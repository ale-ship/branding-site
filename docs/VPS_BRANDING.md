# Noorcom Branding on the Contabo VPS

Written 7 Oct 2026. The branding part of the shared Contabo box, done the same way as the two
projects already on it: its own system user, database, Redis user and port, releases with a
`current` link and rollback, and secrets only on the box. Read `docs/RUNBOOK.md` first; the
backend's design is `docs/BACKEND_RUNBOOK.md`.

The box itself (updates, firewall, fail2ban, the catch-all nginx site, Postgres, Redis, nginx,
certbot, Node) was set up once by Noorcom Hosting's `docs/runbook/VPS_LAYOUT.md` (repository
`Noorcom-Network-NNL/noorcom-networks`) and is shared by Noorcom Computers (`VPS_ELECTRONICS.md` in
its repository). **Do not redo any of it.** This document covers only what branding adds, with the
same commands and rules as those two.

Every `[VPS]` block runs as `root` in an SSH session (root logs in with its password), one block at
a time; Wayne runs them. `[GITHUB]` blocks need an admin of the Noorcom-Network-NNL organisation
(Abdi). `[DNS]` blocks are in the cPanel Zone Editor of the Namecheap reseller hosting account on
host38. Anything written `<LIKE_THIS>` is a placeholder. Never paste a password, key or token into
chat, a ticket or this repository.

---

## 1. Names

| Resource | Value |
|---|---|
| The box | Contabo `vmi3615768`, **144.91.76.57**. 11 GiB memory, 6 CPUs; Node 24, PostgreSQL 17, Redis 7.0, nginx 1.24 (1 Oct 2026) |
| Neighbours | Noorcom Hosting: API `4100`, Redis `nn`, `noorcomnetwork.co.ke` and `app.` (nginx `noorcom-network.conf`, `noorcom-apex.conf`). Noorcom Computers: API `4200`, storefront `4201`, Redis `ne`, `staging.noorcom.co.ke`. The catch-all `00-catch-all.conf` answers unknown names (and serves certificate challenges on port 80) |
| Domains | Staging: `staging.noorcombranding.co.ke`. Live: `noorcombranding.co.ke`, `www.noorcombranding.co.ke` (redirects to the bare name) |
| System user | `noorcom-branding` |
| Site (Next.js) | `127.0.0.1:4301`, unit `noorcom-branding-web` |
| API and worker (from step B1) | `127.0.0.1:4300`, units `noorcom-branding-api`, `noorcom-branding-worker` |
| Postgres | role and database `noorcom_branding` |
| Redis | user `nb`, keys `nb:*`, BullMQ prefix `nb:bull` |
| Env files | `/etc/noorcom-branding/web.env` (site), `hosts.env` (names), `api.env` (API and worker, from B1); `root:noorcom-branding` 640 (`hosts.env` 644) |
| Files | `/var/lib/noorcom-branding/` (made by `--install`; used from B1) |
| Backups | `/var/backups/noorcom-branding/` (made by `--install`; nightly dumps from B1) |
| nginx | `/etc/nginx/sites-available/noorcom-branding.conf` |
| Repository on the box | `/var/www/noorcom-branding/repo`, cloned from `Noorcom-Network-NNL/noorcom-branding` with a read-only deploy key |

### 1.1 The staging name

The zone is served by `rs38a`/`rs38b.registrar-servers.com`, like `noorcom.co.ke` and
`noorcomnetwork.co.ke`: records are edited in the **cPanel Zone Editor on host38** (Namecheap
reseller hosting), not in Namecheap's Advanced DNS. Read from DNS on 7 Oct 2026:

| Name | Type | Value | Note |
|---|---|---|---|
| `@` | A | `199.36.158.100` | Firebase Hosting: the old Lovable site. Rollback value at cutover |
| `www` | CNAME | `noorcom-branding.web.app` | Firebase. Rollback value at cutover |
| `@` | MX | 5 `mx1-hosting.jellyfish.systems`, 10 `mx2-…`, 20 `mx3-…` | Email (Namecheap). Never touched |
| `@` | TXT | `v=spf1 +a +mx +ip4:68.65.122.182 +ip4:68.65.122.183 include:spf.web-hosting.com ~all` | SPF. `+a` authorises whatever `@` points to: review at cutover |
| `@` | TXT | `hosting-site=noorcom-branding` | Firebase's ownership check |

`[DNS]` First copy the whole zone as it is in the Zone Editor into
`docs/DNS_ZONE_SNAPSHOT_<date>.md` (as Noorcom Hosting did for its domain: the editor shows records
DNS lookups don't, and a zone rebuilt from memory misses some). Then add **one record** and change
nothing else:

| Type | Host | Value | TTL |
|---|---|---|---|
| A | `staging` | `144.91.76.57` | 5 min |

Check from the office machine: `nslookup staging.noorcombranding.co.ke` answers `144.91.76.57`.

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

The repository is private. The box gets its own **read-only deploy key**, never copied off it.
A deploy key belongs to one repository, so each project on the box has its own: root's
`/root/.ssh/config` already sends `Host github.com` to Noorcom Hosting's key, and electronics uses
the alias `github-ale-ship-noorcom`. Branding gets the alias `github-noorcom-branding`. GitHub's
host key is already in root's `known_hosts` (checked against GitHub's published fingerprint when
the box was set up), and the alias uses it because its `HostName` is `github.com`.

`[VPS]`
```bash
ssh-keygen -t ed25519 -N '' -C 'noorcom-branding deploy key' -f /root/.ssh/noorcom-branding-deploy
```

`[VPS]`
```bash
printf '\nHost github-noorcom-branding\n  HostName github.com\n  User git\n  IdentityFile /root/.ssh/noorcom-branding-deploy\n  IdentitiesOnly yes\n' >> /root/.ssh/config && chmod 600 /root/.ssh/config
```

`[VPS]`
```bash
cat /root/.ssh/noorcom-branding-deploy.pub
```

`[GITHUB]` Send that one line (the public half) to Abdi, who adds it under
`Noorcom-Network-NNL/noorcom-branding`, Settings, Deploy keys, Add deploy key, title
`app server`, and leaves **Allow write access** unticked. Then:

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

`pg_trgm` and `pg_stat_statements` are not needed by branding (both are already on the box for
the others).

**Redis**: the user `nb` with exactly the rule `nn` and `ne` have (`VPS_LAYOUT.md` section 6), on
the running server first, then in `redis.conf`, so nothing restarts. The box's Redis is 7.0, so the
channel rule `&nb:*` applies. The `default` user is the admin login with `<REDIS_ADMIN_PASSWORD>`
(in the password manager).

`[VPS]`
```bash
openssl rand -hex 24    # keep it as <NB_REDIS_PASSWORD>
```

`[VPS]`
```bash
redis-cli -a '<REDIS_ADMIN_PASSWORD>' --no-auth-warning ACL SETUSER nb on '><NB_REDIS_PASSWORD>' '~nb:*' '&nb:*' +@all -@admin -@dangerous +info +client\|setname +client\|getname +client\|id
```

EXPECT `OK`. Then:

`[VPS]`
```bash
redis-cli --user nb --pass '<NB_REDIS_PASSWORD>' --no-auth-warning set nb:probe 1
redis-cli --user nb --pass '<NB_REDIS_PASSWORD>' --no-auth-warning set ne:probe 1
```

EXPECT `OK`, then `NOPERM`: that refusal is the isolation working. Make it survive a restart:
back up the file, then append the same rule (or to the file an `aclfile` line names, if there is
one):

`[VPS]`
```bash
cp /etc/redis/redis.conf /etc/redis/redis.conf.bak-before-nb && grep -n '^aclfile' /etc/redis/redis.conf
```

```text
# /etc/redis/redis.conf (append)
user nb on ><NB_REDIS_PASSWORD> ~nb:* &nb:* +@all -@admin -@dangerous +info +client|setname +client|getname +client|id
```

The API connects with `REDIS_URL=redis://nb:<NB_REDIS_PASSWORD>@127.0.0.1:6379/0`, names every
key `nb:...` and gives BullMQ `prefix: 'nb:bull'`. When the worker first runs (B2 or B3),
`redis-cli -a '<REDIS_ADMIN_PASSWORD>' --no-auth-warning ACL LOG` should be empty.

From B1: the API and worker units, `api.env`, migrations in the deploy, and a nightly backup
(`pg_dump -Fc` to `/var/backups/noorcom-branding/`, 14 days, a timer at 02:30 like
electronics') with a restore check. `docs/BACKEND_RUNBOOK.md` section 10 has the plan.

---

## 9. Cutover to noorcombranding.co.ke

After the launch checklist in `docs/RUNBOOK.md`:

1. A day before: re-read the zone and compare it with the snapshot (section 1.1); TTL 300 on the
   `@` A record and the `www` CNAME, then wait at least the old TTL.
2. On the day, **DNS first** (the certificate is issued over HTTP): `@` A to `144.91.76.57`;
   delete the `www` CNAME and add `www` as an A record to `144.91.76.57`. Leave MX, the TXT records
   and `staging` alone. Wait until `nslookup noorcombranding.co.ke rs38a.registrar-servers.com`
   and the same for `www.` both answer `144.91.76.57`.
3. `certbot certonly --webroot -w /var/www/letsencrypt -d noorcombranding.co.ke -d www.noorcombranding.co.ke`.
4. `hosts.env`: `SITE_HOST=noorcombranding.co.ke`, `WWW_HOST=www.noorcombranding.co.ke`, remove
   `NOINDEX`. `web.env`: `NEXT_PUBLIC_SITE_URL=https://noorcombranding.co.ke`. Then `--install`
   and a deploy (the site bakes its address in). Keep the gap between steps 2 and 4 short.
5. `smoke-branding.sh https://noorcombranding.co.ke`, then the rest of the launch checklist (Search
   Console, Google Business Profile, a WhatsApp link preview). Keep the Lovable project and its
   Firebase site a week.
6. SPF's `+a` now authorises `144.91.76.57` instead of Firebase. Nothing sends mail from the box
   yet; when the backend does, it sends through the mailbox's SMTP (as electronics does), and the
   SPF record is reviewed then. Check mail to and from `info@noorcombranding.co.ke` still works.

**Rollback** (minutes, the TTL is 300): `@` A back to `199.36.158.100`; delete the `www` A record
and put back the CNAME to `noorcom-branding.web.app`.

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
| The neighbours still answer: `https://staging.noorcom.co.ke` and its admin, `https://app.noorcomnetwork.co.ke` | |
| `ufw status` still lists 22, 80 and 443 only (nothing to open for branding) | |
| (B1) `psql` as `noorcom_branding` connects to its own database, refused on `noorcom_network` and `noorcom_electronics` | |
| (B1) Redis user `nb` gets `OK` on `nb:probe` and `NOPERM` on `ne:probe` | |
