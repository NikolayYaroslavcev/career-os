# HH API Cloud Test

This directory contains scripts to test HeadHunter API connectivity from various cloud environments.

## Quick Test (Local)

```bash
node scripts/hh-test-curl.js
```

## GitHub Actions

Push to main or trigger manually:

```bash
gh workflow run hh-cloud-test.yml
gh run watch
```

## Railway

```bash
railway login
railway init
railway up
railway logs
```

## Fly.io

```bash
fly auth login
fly launch --copy-config --name hh-api-test
fly deploy
fly logs
```

## Expected Results

If DDoS-Guard is blocking our IP specifically:
- GitHub Actions: May succeed (different IP range)
- Railway: May succeed (European IPs)
- Fly.io: May succeed (European IPs)

If DDoS-Guard is blocking cloud IPs generally:
- All environments will return 403
