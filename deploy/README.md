# Running the collector off the laptop

The pipeline used to run on a MacBook via launchd, which meant a closed lid was
an outage: no collection, no enrichment and — the part that matters — no
alerts. A day without collection cannot be backfilled, so this is the piece
worth moving first.

The website is unaffected either way; it is on Vercel and reads Neon directly.
What moves here is only the thing that *writes*.

## Choosing a box

| | cost | notes |
|---|---|---|
| Oracle Cloud Always Free | **₹0** | ARM VM, no expiry. Free-tier capacity can be hard to get at signup; Oracle reclaims *idle* free instances, which this is not. |
| Hetzner CX22 (Ashburn) | ~$4.59/mo | Boring and reliable. US region matters — Neon is in `us-east-1`. |
| A Pi or old laptop at home | ₹0 | Same software. Your power and broadband become the dependency. |

Ruled out, to save you the attempt:

- **Vercel Cron** — functions cap at 300s; cycles run 9–48 minutes. Hobby crons
  fire once a day.
- **GitHub Actions** — free only for public repos. Private allows 2,000
  minutes a month; this needs roughly 21,000.

## Install

```bash
sudo bash deploy/setup.sh
```

It installs Node 24, clones to `/opt/agri` as a non-login `agri` user, and
installs the systemd unit. It stops before starting, because it does not write
secrets — a script taking API keys as arguments leaves them in shell history
and in the process table.

Then fill in `/opt/agri/.env.local` and:

```bash
sudo systemctl enable --now agri-scheduler
journalctl -u agri-scheduler -f
```

## Secrets that have to move

`DATABASE_URL`, `OPENAI_API_KEY`, `APIFY_API_TOKEN`, `YOUTUBE_API_KEY`,
`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PUBLIC_SITE_URL`.

This is a second place your credentials live. Rotate them here if the laptop is
ever compromised, and keep `.env.local` at mode 600.

Without the VAPID pair, push is inert and says nothing — `pushConfigured()`
returns false and the alert stage returns quietly. That is the one omission
that fails silently rather than loudly.

## Turning off the laptop's copy

Run both and you get double collection and double Apify spend. Once the server
is confirmed working:

```bash
./scripts/install-scheduler.sh --uninstall
```

## Cadence and cost

`SCHEDULER_CYCLE_MINUTES=30` is counted *after* a cycle ends, so the real gap
is cycle-duration plus 30. That is deliberate. Per-cycle caps multiplied by
cycles-per-day are the whole cost model — the YouTube free quota is 100
searches a day and Apify bills per run — so shortening the interval spends
money rather than buying freshness.
