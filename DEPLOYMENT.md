# Deployment Guide

This project uses GitHub Actions to build and push Docker images to GHCR, then deploys to EC2 via SSH.

## Architecture

```
GitHub Push → GitHub Actions → Build Image → Push to GHCR → SSH to EC2 → Pull & Restart
```

## Required GitHub Secrets

Configure these in your repository under **Settings → Secrets and variables → Actions**:

| Secret | Description | Example |
|--------|-------------|---------|
| `EC2_HOST` | EC2 public IP or DNS | `ec2-1-2-3-4.compute-1.amazonaws.com` |
| `EC2_USER` | SSH user for deployment | `deploy` |
| `EC2_SSH_KEY` | Private SSH key for deploy user | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `GHCR_PAT` | GitHub PAT with `read:packages` scope (optional) | `ghp_xxxx` |

### Notes on Secrets

- **GHCR_PAT**: Required for EC2 to pull images from GHCR. Create a Personal Access Token with `read:packages` scope. The workflow will use `GITHUB_TOKEN` for build/push (works automatically), but EC2 pull requires a PAT since GITHUB_TOKEN isn't valid outside GitHub Actions context.

## GHCR Image

- **Image**: `ghcr.io/probabilityexchange-sketch/agent-platform`
- **Tags**: `latest` and `<git-sha>` on each push to main

## Container Details

- **Container name**: `agent-platform-web`
- **Internal port**: 3000
- **External access**: Via Traefik reverse proxy (ports 80/443)

## EC2 Setup (Pre-configured)

The EC2 instance has:
1. `deploy` user in `docker` group
2. Deployment script at `/usr/local/bin/deploy_agent_platform.sh`
3. Docker Compose v2 installed

## Manual Deployment

To manually trigger a deployment on EC2:

```bash
ssh deploy@<EC2_HOST>
cd /home/ec2-user/agent-platform
export GHCR_TOKEN="your-pat-here"
/usr/local/bin/deploy_agent_platform.sh
```

## Troubleshooting

### View container logs
```bash
docker logs agent-platform-web -f
```

### Restart services
```bash
cd /home/ec2-user/agent-platform
docker compose -f docker-compose.prod.yml restart app
```

### Check service status
```bash
docker compose -f docker-compose.prod.yml ps
```
