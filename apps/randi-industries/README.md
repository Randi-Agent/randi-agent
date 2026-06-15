# Randi Industries

Internal product / R&D for Randi Industries.

## Purpose
Long-lived products, internal tools, and proprietary codebases owned by Randi Industries.

## Stack conventions
- Node LTS (nvm) for services / tooling
- Python 3.14 + `uv` for data + scripts
- `pipx` for one-off CLI tools
- VS Code as editor

## Folder conventions
```
services/<name>/   # Node or Python services
packages/<name>/   # shared libraries
data/              # datasets (gitignored unless small)
infra/             # IaC, deploys
```

## Python workflow (uv)
```bash
uv venv .venv
source .venv/bin/activate
uv pip install -r requirements.txt
# or
uv sync            # if pyproject.toml
```

## Secrets
- `.env` locally only. `.env.example` is committed.
