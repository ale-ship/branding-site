# Noorcom Branding on the Contabo VPS

Written 7 Oct 2026 for the shared Contabo box; from 22 Oct 2026 for branding's own VPS,
**164.68.107.101**, which already runs other projects (section 0). Branding gets its own system
user, database, Redis user and ports, releases with a `current` link and rollback, and secrets only
on the box. Read `docs/RUNBOOK.md` first; the backend's design is `docs/BACKEND_RUNBOOK.md`.

What the box already has (Node, Postgres, Redis, nginx, certbot, firewall) is read by the Phase 0
inventory (section 0) before anything is installed. What is there is used, never redone, and
nothing the other projects use is changed. The commands below follow Noorcom Hosting's
`docs/runbook/VPS_LAYOUT.md` (repository `Noorcom-Network-NNL/noorcom-networks`) where the box needs
the same base.

**Production (22 Oct 2026):** one deploy ships everything: the site, the API and its worker, the
database migrations and seeds, and the staff back office, with a database backup before every
migration and a nightly one. The site runs on the API (`NEXT_PUBLIC_API_MODE=live`) with payments by
hand.

Every `[VPS]` block runs as `root` in an SSH session (root logs in with its password), one block at
a time; Wayne runs them. `[GITHUB]` blocks need an admin of the Noorcom-Network-NNL organisation
(Abdi). `[DNS]` blocks are in the cPanel Zone Editor of the Namecheap reseller hosting account on
host38. Anything written `<LIKE_THIS>` is a placeholder. Never paste a password, key or token into
chat, a ticket or this repository.

---

## 0. The new box (22 Oct 2026): Phase 0, the inventory

The owner has a VPS for branding: **164.68.107.101**. It is **not** the shared box this document
was written for (144.91.76.57, section 1), so "do not redo" no longer holds as written: what the
shared box's runbook set up may or may not be on this one. Seen from outside on 22 Oct 2026: Ubuntu
(OpenSSH 9.6p1, Ubuntu 24.04), root logs in with a password only, nginx answers on port 80 with
another project's app (**PROLL · Payroll**), and port 443 does not answer. `/var/www` holds `fatco`,
`html`, `letsencrypt` and `proll`. So the box is shared with those projects, which must keep working.

Phase 0 changes nothing. `[VPS]` Copy `deploy/scripts/inventory-branding.sh` to the box (for
example `nano /root/inventory-branding.sh` and paste it), then:

```bash
bash /root/inventory-branding.sh 2>&1 | tee /root/inventory-branding.txt
```

It prints the machine, memory and disk, the firewall and SSH settings, listening ports, installed
software (Node, Postgres, Redis, nginx, certbot), running services, nginx sites (names, listens and
proxy targets only), certificates, Postgres databases and roles, Redis users, and whether any of
branding's names, ports and folders are taken. It prints no secrets. Paste the output back; from it
the rest of this document is rewritten for this box (what to install, which ports are free, how
the payroll app's nginx site and ours sit side by side) before anything is installed.

---

## 1. Names

| Resource | Value |
|---|---|
| The box | Contabo `vmi3614117`, **164.68.107.101**, Ubuntu 24.04. Memory, CPUs and software: from the inventory (section 0) |
| Neighbours | Seen 22 Oct 2026: `/var/www/fatco` and `/var/www/proll` (the PROLL payroll app answers on port 80 by IP). Their ports, databases, Redis users and nginx sites: from the inventory. They must keep working through every step here |
| Domains | Staging: `staging.noorcombranding.co.ke`. Live: `noorcombranding.co.ke`, `www.noorcombranding.co.ke` (redirects to the bare name) |
| System user | `noorcom-branding` |
| Site (Next.js) | `127.0.0.1:4301`, unit `noorcom-branding-web` |
| API and worker | `127.0.0.1:4300`, units `noorcom-branding-api`, `noorcom-branding-worker`. During a deploy the new API also answers on `127.0.0.1:4302` for a minute, for the site's build |
| Back office | static files in the release's `admin/`, served by nginx at `/admin/` |
| Backups | `noorcom-branding-backup.timer`, 02:45 nightly, and before every migration |
| Postgres | role and database `noorcom_branding` |
| Redis | user `nb`, keys `nb:*`, BullMQ prefix `nb:bull` |
| Env files | `/etc/noorcom-branding/web.env` (site), `api.env` (API and worker), `hosts.env` (names); `root:noorcom-branding` 640 (`hosts.env` 644) |
| Files | `/var/lib/noorcom-branding/` (`storage/`, `mail-outbox/`, `whatsapp-outbox/`; made by `--install`) |
| Backup folder | `/var/backups/noorcom-branding/` (root only; made by `--install`) |
| nginx | `/etc/nginx/sites-available/noorcom-branding.conf` |
| Repository on the box | `/var/www/noorcom-branding/repo`, cloned from `Noorcom-Network-NNL/noorcom-branding` with a read-only deploy key |

### 1.1 The staging name

The zone is served by `rs38a`/`rs38b.registrar-servers.com`, like `noorcom.co.ke` and
`noorcomnetwork.co.ke`: records are edited in the **cPanel Zone Editor on host38** (Namecheap
reseller hosting), not in Namecheap's Advanced DNS. The domain is the cPanel account
`noorcombranding` (server 68.65.122.187, reseller `noorcom1`, seen in WHM on 22 Oct 2026): its Zone
Editor holds the records and its Email Accounts the `info@` mailbox, whose SMTP settings
(Email Accounts, Connect Devices: the outgoing server, port 465, SSL) go in `api.env`. Read from DNS on 7 Oct 2026:

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
| A | `staging` | `164.68.107.101` | 5 min |

Check from the office machine: `nslookup staging.noorcombranding.co.ke` answers `164.68.107.101`.

Staging sends `X-Robots-Tag: noindex` (`NOINDEX=yes` in `hosts.env`), so search engines don't
index it as a copy of the future live site.

### 1.2 Memory

`[VPS]`
```bash
free -h; nproc
```

Running: the site, the API and the worker, about 600 MB together (PDFs are drawn with pdfkit, no
browser). Building: about 1.5 GB more for a few minutes (`next build`). Plan on 2 GB free for
branding; the inventory shows what the other projects use.

---

## 2. Folders

```text
/var/www/noorcom-branding/
├── repo/                          git clone of the repository (detached at origin/main by each deploy)
├── releases/
│   └── 20261022-1000-f8971ef/
│       ├── web/                   Next.js standalone output: server.js, .next/static, public
│       ├── api/                   backend/, shared/, node_modules/ (production only), build.env, backup-branding.sh
│       └── admin/                 the back office's build (index.html, assets/)
└── current -> releases/20261022-1000-f8971ef
```

Releases belong to `root:noorcom-branding` and are read only to the services; the site writes only
`web/.next/cache` (next/image's optimised copies), the API and worker only `/var/lib/noorcom-branding`.
`admin/` is readable by nginx. Builds happen in `/var/tmp`, then the switch.

---

## 3. Access to the repository: a deploy key

The repository is private. The box gets its own **read-only deploy key**, never copied off it.
A deploy key belongs to one repository, so each project on the box has its own key and its own
alias in root's `/root/.ssh/config` (the other projects' entries are left as they are). Branding
gets the alias `github-noorcom-branding`. The first `ssh -T` below asks to trust GitHub's host key:
compare the fingerprint with the one GitHub publishes (docs.github.com, "GitHub's SSH key
fingerprints") before answering yes.

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

Values are written without quotes (systemd reads them, and the deploy reads them the same way);
`--install` refuses while any `<PLACEHOLDER>` is left.

- `/etc/noorcom-branding/hosts.env`: `SITE_HOST=staging.noorcombranding.co.ke`, `NOINDEX=yes`, no
  `WWW_HOST` on staging.
- `/etc/noorcom-branding/web.env` (`deploy/env/web.env.example`): `PORT=4301`, `HOSTNAME=127.0.0.1`,
  `NEXT_PUBLIC_SITE_URL=https://staging.noorcombranding.co.ke`, `NEXT_PUBLIC_API_MODE=live`,
  `API_INTERNAL_URL=http://127.0.0.1:4300`, `REVALIDATE_SECRET`. `NEXT_PUBLIC_*` are baked in at
  build time: a change needs a deploy, not a restart.
- `/etc/noorcom-branding/api.env` (`deploy/env/api.env.example`; every setting is explained in
  `backend/.env.example` and `docs/BACKEND_RUNBOOK.md` section 11): the database and Redis URLs
  (section 8), SMTP, and the secrets `FILES_SECRET` and `REVALIDATE_SECRET`, each made on the box
  with `openssl rand -hex 32`, pasted straight into the file and never shown or copied off it.
- With the website editor, both need `REVALIDATE_SECRET` (the same value: the API asks the site to
  refresh after staff change the website), and `api.env` has `SITE_INTERNAL_URL=http://127.0.0.1:4301`.
  The site's `POST /revalidate` is outside `/api/`, so nginx sends it to the site; only the API, on
  this machine, calls it. Uploaded photos live under `STORAGE_DIR` until R2 and belong in the backup.
- The site's build reads its pages from the API. The deploy starts the new API on `4302` for the
  build, so it works on the first deploy too, before any API is running.
- Customer accounts (B5) sign in with a code sent by email, so `api.env` needs the mailbox's SMTP
  (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM=info@noorcombranding.co.ke`), and
  `STAFF_INBOX` is where quote requests and messages go. Without `SMTP_HOST` the mail is only written
  to `MAIL_OUTBOX_DIR` on the box; the API refuses to start on the live site's address without it.
- Payments by hand (owner, 21 Oct 2026), until Absa's M-Pesa prompt is connected: `api.env` keeps
  `PAYMENTS_MODE=manual` (the default; Absa's callback secret isn't needed then) and, with no WhatsApp
  Business account yet, `WHATSAPP_MODE=off` (customers get the email only). `web.env` leaves
  `NEXT_PUBLIC_PAYMENTS_MODE` unset (manual). With these and SMTP set, the API starts on the live
  site's address. When the prompt goes live: `PAYMENTS_MODE=prompt` and
  `NEXT_PUBLIC_PAYMENTS_MODE=prompt` (a deploy), with `ABSA_CALLBACK_SECRET`.

---

## 5. First deploy

In order, after the inventory (section 0), the deploy key (section 3), the staging DNS record
(section 1.1), and the database and Redis user (section 8). Each `--install` is safe to run again.

`[VPS]`
```bash
git clone git@github-noorcom-branding:Noorcom-Network-NNL/noorcom-branding.git /var/www/noorcom-branding/repo
bash /var/www/noorcom-branding/repo/deploy/scripts/deploy-branding.sh --install
```

The first run creates the user and folders, writes `hosts.env`, `web.env` and `api.env` from the
examples, and stops. Fill them in (section 4), then run `--install` again: it installs the services
and the backup timer, then stops again because there is no certificate yet. **The certificate comes
before the nginx site**: a site that points at a missing certificate fails `nginx -t` for every
project on the box. So this run enables only a small port-80 site for our name (its own file,
`noorcom-branding-acme.conf`) for certbot to answer through, and prints the command:

`[VPS]`
```bash
certbot certonly --webroot -w /var/www/letsencrypt -d staging.noorcombranding.co.ke
bash /var/www/noorcom-branding/repo/deploy/scripts/deploy-branding.sh --install
bash /var/www/noorcom-branding/repo/deploy/scripts/deploy-branding.sh
```

The second `--install` swaps the port-80 site for the full one. The deploy builds the first release
(about 10 minutes: the API's packages, a database backup, the migrations and seeds, the back office,
the site) and ends with `[deploy] live: <release>`. Then the first staff account, the admin (the
password is asked for and not shown); the admin adds the two designers in the back office, each with
their own email:

`[VPS]`
```bash
cd /var/www/noorcom-branding/current/api/backend
env DATABASE_URL="$(grep '^DATABASE_URL=' /etc/noorcom-branding/api.env | cut -d= -f2-)" \
  node src/cli/add-staff.js --email <ADMIN_EMAIL> --name "<ADMIN NAME>" --role admin
```

Then, from anywhere:

```bash
bash deploy/scripts/smoke-branding.sh https://staging.noorcombranding.co.ke
```

---

## 6. nginx

`deploy/nginx/noorcom-branding.conf`, written by `--install` with the names from `hosts.env`:
port 80 to HTTPS (and the ACME challenge); `/api/` to the API on `127.0.0.1:4300` (uploads up to
50 MB); `/admin/` the back office's static build from the live release (`try_files $uri
/admin/index.html`, never indexed, its hashed `assets/` cached a year); everything else to the site
on `127.0.0.1:4301`, with a year's cache on `/_next/static`; gzip, HSTS. The www block is kept only
when `WWW_HOST` is set (live), the `X-Robots-Tag` only when `NOINDEX=yes` (staging). If `nginx -t`
fails with the new file, the previous one is put back. The other security headers come from the
site (`next.config.ts`).

When Absa's prompt is connected (`PAYMENTS_MODE=prompt`), the callback paths get Absa's IP ranges
(`docs/BACKEND_RUNBOOK.md` section 10).

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
2. Builds a new release `YYYYMMDD-HHMM-<commit>`: the API with production packages only
   (`npm ci --omit=dev --workspace=backend`), the back office (`npm run admin:build`).
3. Backs up the database (`pre-deploy-<release>.dump`, the last five kept), then runs the
   migrations and the seeds (which add, never overwrite) as the service user.
4. Starts the new API on `127.0.0.1:4302` and builds the site against it (`web.env` loaded,
   `next build`, standalone), then stops it.
5. Refuses to switch to a release missing a part.
6. Switches `current` in one step and restarts the API, the worker and the site.
7. Waits up to 30 s for `/api/health` to say `ok` with the new build id, and for `/` and
   `/robots.txt`; if not, puts the previous release back.
8. Keeps the newest five releases.

A rollback (`--rollback`, or step 7 failing) puts the previous code back but **not** the database:
a migration must keep the previous release working (add columns and tables; rename or drop only in
a later deploy). To go back further, restore the `pre-deploy` dump (section 8).

---

## 8. Postgres, Redis and backups (before the first deploy)

If the inventory shows no Postgres or Redis on the box, install them first (`apt install
postgresql redis-server`, Redis bound to 127.0.0.1 with a `default` admin password, as in
`VPS_LAYOUT.md`). If they are there, use them as they are. The database work happens here, on the
box (owner, 7 Oct 2026); a local copy on the office machine
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

Branding needs no Postgres extension.

**Redis**: the user `nb`, limited to its own keys, on the running server first, then in
`redis.conf`, so nothing restarts. From Redis 7 the channel rule `&nb:*` applies (the inventory
shows the version; on 6.2 leave it out). The `default` user is the admin login with `<REDIS_ADMIN_PASSWORD>`
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
redis-cli --user nb --pass '<NB_REDIS_PASSWORD>' --no-auth-warning set other:probe 1
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

**Backups** (`deploy/scripts/backup-branding.sh`, `noorcom-branding-backup.timer`, 02:45 nightly):
`db-<date>.dump` (`pg_dump -Fc`, checked with `pg_restore --list`) and `files-<date>.tar.gz` (the
stored photos, proofs and files) in `/var/backups/noorcom-branding/`, kept 14 days, plus a
`pre-deploy-` dump before every migration. Run one by hand: `systemctl start
noorcom-branding-backup`, then `journalctl -u noorcom-branding-backup`. A restore check, once a
month, into a scratch database:

`[VPS]`
```bash
sudo -u postgres createdb nb_restore_check
sudo -u postgres pg_restore --no-owner -d nb_restore_check "$(ls -1t /var/backups/noorcom-branding/db-*.dump | head -1)"
sudo -u postgres psql -d nb_restore_check -Atc 'SELECT count(*) FROM orders'
sudo -u postgres dropdb nb_restore_check
```

Copies off the box come with R2 (until then, download one now and then to the office machine).

---

## 9. Cutover to noorcombranding.co.ke

After the launch checklist in `docs/RUNBOOK.md`:

1. A day before: re-read the zone and compare it with the snapshot (section 1.1); TTL 300 on the
   `@` A record and the `www` CNAME, then wait at least the old TTL.
2. On the day, **DNS first** (the certificate is issued over HTTP): `@` A to `164.68.107.101`;
   delete the `www` CNAME and add `www` as an A record to `164.68.107.101`. Leave MX, the TXT records
   and `staging` alone. Wait until `nslookup noorcombranding.co.ke rs38a.registrar-servers.com`
   and the same for `www.` both answer `164.68.107.101`.
3. `hosts.env`: `SITE_HOST=noorcombranding.co.ke`, `WWW_HOST=www.noorcombranding.co.ke`, remove
   `NOINDEX`. `--install` (it puts up the port-80 site for the new names), then
   `certbot certonly --webroot -w /var/www/letsencrypt -d noorcombranding.co.ke -d www.noorcombranding.co.ke`.
4. `web.env`: `NEXT_PUBLIC_SITE_URL=https://noorcombranding.co.ke`; `api.env`: `SITE_ORIGIN` and
   `PUBLIC_URL` the same (the API then insists on SMTP being set). Then `--install` and a deploy
   (the site bakes its address in). Keep the gap between steps 2 and 4 short.
5. `smoke-branding.sh https://noorcombranding.co.ke`, then the rest of the launch checklist (Search
   Console, Google Business Profile, a WhatsApp link preview). Keep the Lovable project and its
   Firebase site a week.
6. SPF's `+a` now authorises `164.68.107.101` instead of Firebase. The backend sends mail (sign-in
   codes and order messages) through the mailbox's SMTP (as electronics does), so the SPF record
   must allow that server, and DKIM should be on, or the codes land in spam. Check mail to and from `info@noorcombranding.co.ke` still works.

**Rollback** (minutes, the TTL is 300): `@` A back to `199.36.158.100`; delete the `www` A record
and put back the CNAME to `noorcom-branding.web.app`.

---

## 10. Gate

| Check | Result |
|---|---|
| `ssh -T git@github-noorcom-branding` authenticates, read only | |
| `nslookup staging.noorcombranding.co.ke` answers 164.68.107.101 | |
| `/etc/noorcom-branding/web.env` and `api.env` are `root:noorcom-branding` 640 | |
| `ss -ltnp` shows 4300 and 4301 on `127.0.0.1` only | |
| `curl -s https://staging.noorcombranding.co.ke/api/health` says `ok`, with the release's build id | |
| The admin signs in at `/admin/`; each designer with their own account; Activity lists them | |
| An order placed on staging, its payment recorded by a designer, the receipt and the emails arrive | |
| `systemctl list-timers noorcom-branding-backup.timer` shows the next run; a backup by hand works and the restore check counts the orders | |
| `nginx -t` passes with every project's sites enabled | |
| `smoke-branding.sh https://staging.noorcombranding.co.ke`: every line `ok` | |
| `curl -sI https://staging.noorcombranding.co.ke` shows `X-Robots-Tag: noindex, nofollow` | |
| `npm run a11y`, `devices`, `menu` with `BASE=https://staging.noorcombranding.co.ke` pass | |
| A deploy, then `--rollback`, then a deploy again all complete | |
| The neighbours still answer as before: the PROLL app and fatco (their addresses from the inventory) | |
| `ufw status` lists 22, 80 and 443 only (nothing else to open for branding) | |
| `psql` as `noorcom_branding` connects to its own database and is refused on the others | |
| Redis user `nb` gets `OK` on `nb:probe` and `NOPERM` on `other:probe` | |
