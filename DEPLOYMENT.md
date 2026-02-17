# Deployment Guide

This project deploys to AWS EC2 through GitHub Actions and GHCR.

Architecture:

```text
GitHub Push -> GitHub Actions -> Build Image -> Push GHCR -> SSH EC2 -> Pull -> Migrate -> Seed -> Restart -> Verify
```

## Required GitHub Secrets

Configure in GitHub: `Settings -> Secrets and variables -> Actions`.

| Secret | Description | Example |
|--------|-------------|---------|
| `EC2_HOST` | EC2 public IP or DNS | `ec2-1-2-3-4.compute-1.amazonaws.com` |
| `EC2_USER` | SSH user for deployment | `deploy` |
| `EC2_SSH_KEY` | Private SSH key | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `GHCR_PAT` | PAT with `read:packages` | `ghp_xxxx` |

Notes:
- EC2 needs `GHCR_PAT` to pull private GHCR images.
- GitHub Actions can still push with `GITHUB_TOKEN`.

## Image and Service Targets

- Image: `ghcr.io/probabilityexchange-sketch/agent-platform`
- Tags: `latest` and `sha-*`
- App container: `agent-platform-web`
- Compose file: `docker-compose.prod.yml`

## AWS/EC2 Rollout Runbook (Token Credits Ledger)

### Ordered Rollout
1. Build and push image to GHCR.
2. Pull image on EC2.
3. Apply database migrations.
4. Run seed.
5. Restart app.
6. Run smoke tests.
7. Run reconciliation checks.

### Prechecks

Run before production rollout:
- [ ] GitHub Actions workflow is green for target commit.
- [ ] Target image exists in GHCR.
- [ ] EC2 SSH access confirmed.
- [ ] Production `.env` includes required auth, Solana, token, and database vars.
- [ ] DB snapshot created immediately before deploy.
- [ ] Current service baseline captured:
  - `docker compose -f docker-compose.prod.yml ps`
  - `docker logs agent-platform-web --tail 200`

### Deployment Commands (EC2)

```bash
ssh deploy@<EC2_HOST>
cd /home/ec2-user/agent-platform

# Ensure GHCR login is valid first (if needed)
docker compose -f docker-compose.prod.yml pull app
docker compose -f docker-compose.prod.yml up -d app

# Schema/data updates
docker compose -f docker-compose.prod.yml exec -T app npx prisma migrate deploy
docker compose -f docker-compose.prod.yml exec -T app npx prisma db seed

# Confirm status
docker compose -f docker-compose.prod.yml ps
docker logs agent-platform-web --tail 200
```

### Post-Deploy Smoke Tests

Verify the happy-path flow in order:
1. Auth/session works (`/api/auth/me` after login returns 200).
2. Platform config endpoint returns expected values (`/api/config`).
3. Purchase intent create works (`POST /api/purchase-intents`).
4. Purchase intent verify works (`POST /api/purchase-intents/{id}/verify`).
5. Credits balance reflects expected ledger updates (`GET /api/credits/balance`).
6. Credits UI can complete end-to-end flow.
7. No sustained 5xx for auth/credits/purchase-intent routes.

### Reconciliation Checklist

- [ ] Verified purchase intents count matches confirmed credit transactions.
- [ ] No stale `PENDING` intents beyond expected window.
- [ ] No duplicate credits for a single tx signature.
- [ ] No unexpected negative balances.

## Rollback Procedure

If the rollout causes payment/ledger instability:
1. Stop or gate verification traffic path.
2. Roll app image back to previous known-good tag.
3. Restore pre-deploy DB snapshot if schema/data mismatch is present.
4. Re-run smoke tests and reconciliation before closing incident.

## Change Ticket Template

Use this for production rollout approvals and audit trail:

```md
Title: Secure token purchase-intent credits ledger rollout (AWS/EC2)

Window:
- Start:
- End:
- Owner:
- On-call:

Scope:
- Commit(s):
- Environment: production

Prechecks:
- [ ] Actions green
- [ ] GHCR image present
- [ ] DB snapshot taken
- [ ] EC2 access verified

Deploy:
- [ ] pull image
- [ ] migrate deploy
- [ ] db seed
- [ ] restart app

Validation:
- [ ] auth check
- [ ] purchase-intent create/verify
- [ ] credits balance correctness
- [ ] logs stable

Rollback ready:
- [ ] previous image tag identified
- [ ] snapshot restore plan confirmed
```
