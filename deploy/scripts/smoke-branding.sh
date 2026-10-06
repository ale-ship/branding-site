#!/usr/bin/env bash
# smoke-branding.sh  -  after a deploy, check the public site answers as it should.
#   smoke-branding.sh https://noorcombranding.co.ke
# Prints one line per check and exits non-zero if any fails.
set -uo pipefail
BASE=${1:?usage: smoke-branding.sh https://<host>}
fail=0

expect() {
  local path=$1 want=$2 got
  got=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$BASE$path")
  if [[ $got == "$want" ]]; then echo "ok   $want $path"; else echo "FAIL $path: wanted $want, got $got"; fail=1; fi
}

for path in / /work /services /services/apparel /shop /shop/business-cards /order '/order/new?product=business-cards' /quote /account /about /contact /privacy /terms /robots.txt /sitemap.xml /opengraph-image /icon.png; do
  expect "$path" 200
done
expect /no-such-page 404
# The old Lovable addresses.
expect /checkout 308
expect /admin 307

# The live address must be in the sitemap, not localhost.
if curl -s --max-time 20 "$BASE/sitemap.xml" | grep -q "<loc>$BASE/</loc>"; then
  echo "ok   sitemap uses $BASE"
else
  echo "FAIL sitemap does not use $BASE (check NEXT_PUBLIC_SITE_URL and redeploy)"; fail=1
fi
exit $fail
