# Deploy — 1Password Credential Broker + GitHub Actions

The **Deploy to Vercel** workflow (`.github/workflows/deploy.yml`) runs on every push to `main`. It syncs app env vars to Vercel, builds, and deploys. **Application secrets are not stored in GitHub.** They live in a [1Password Environment](https://support.1password.com/environments/) and are loaded at workflow runtime through [1Password Credential Broker](https://www.1password.dev/brokered-access/github-actions) (Workload Identity / OIDC).

## How the flow works

1. GitHub Actions runs the deploy job with `permissions: id-token: write` so GitHub can mint a short-lived OIDC token.
2. The **Load secrets from 1Password** step (`1password/load-secrets-action@v5`) presents that identity plus your integration key to 1Password.
3. 1Password validates the workload (org, repo, workflow, branch) and returns the Environment variables.
4. With `export-env: true`, those values become normal shell environment variables (`VERCEL_TOKEN`, `SUPABASE_URL`, etc.).
5. Later steps sync Supabase/Auth0 vars to Vercel and run `vercel pull`, `vercel build`, and `vercel deploy` using `$VERCEL_TOKEN` and the rest from env.

Official reference: [Use 1Password Credential Broker to access secrets in GitHub Actions](https://www.1password.dev/brokered-access/github-actions).

## What admins configure (one-time)

### Connect GitHub to 1Password

An organization administrator must connect the **BlueMountainsIT** GitHub organization to your 1Password Business account (Credential Broker setup). Without this, the 1Password desktop app will not offer GitHub Actions as a destination for an Environment.

### Organization secret in GitHub

Add a single organization-level Actions secret:

| Name | Source |
|------|--------|
| `OP_INTEGRATION_KEY` | Provided when the GitHub ↔ 1Password integration is created |

Do **not** add `VERCEL_*`, `SUPABASE_*`, or `AUTH0_*` as GitHub secrets for the normal deploy path.

### Repository or organization variables

After connecting an Environment to this repo’s workflow in the 1Password desktop app, copy the snippet values into GitHub **Variables** (repository or organization scope, as your team prefers):

| Variable | Purpose |
|----------|---------|
| `OP_WORKLOAD_ID` | Identifies the broker workload for this workflow connection |
| `OP_ENVIRONMENT_ID` | Identifies the 1Password Environment that holds deploy secrets |

These appear in the GitHub Actions snippet shown in 1Password when you **Connect** the Environment.

### 1Password Environment contents

The Environment must define **exactly these names** (same as `.env.example` in the repo):

| Variable | Used for |
|----------|----------|
| `VERCEL_TOKEN` | Vercel CLI auth |
| `VERCEL_ORG_ID` | Vercel team/org |
| `VERCEL_PROJECT_ID` | Vercel project |
| `SUPABASE_URL` | Synced to Vercel production env |
| `SUPABASE_ANON_KEY` | Synced to Vercel production env |
| `AUTH0_SECRET` | Synced to Vercel production env |
| `AUTH0_BASE_URL` | Synced to Vercel production env |
| `AUTH0_ISSUER_BASE_URL` | Synced to Vercel production env |
| `AUTH0_CLIENT_ID` | Synced to Vercel production env |
| `AUTH0_CLIENT_SECRET` | Synced to Vercel production env |

Dev Lab values belong in the Environment for the current session — copy from there locally; do not commit real values to git.

### Connect the Environment to this workflow

In the 1Password desktop app:

1. Open the Dev Lab **Environment** and add or update the variables above.
2. In the **GitHub Actions** section, choose **Connect** (or **Connect** again if updating).
3. Select the integration for **BlueMountainsIT**, enter repository **`AS-dev-lab`**, and optionally restrict to workflow **Deploy to Vercel** / branch **`main`**.
4. Copy `OP_WORKLOAD_ID` and `OP_ENVIRONMENT_ID` into GitHub variables; ensure `OP_INTEGRATION_KEY` is set at org level.

## Verify

Push to `main` or re-run **Deploy to Vercel**. Steps should succeed in order: checkout → load from 1Password → verify env vars → install → sync to Vercel → pull → build → deploy.

If **Verify required secrets** fails, the log lists missing names. Fix the 1Password Environment or the broker connection — not GitHub repository secrets for those app values.

Common OIDC failures: ensure the job has `permissions: id-token: write` (already set in `deploy.yml`).

## Deprecated fallback: all secrets in GitHub

Storing every deploy value as a GitHub Actions repository secret still works if you revert `deploy.yml` to map `secrets.*` in a job-level `env:` block and remove the 1Password load step. That approach duplicates 1Password and is **deprecated** for this repo once Credential Broker is enabled. Historical step-by-step for Vercel token and ID discovery lived in the old `docs/vercel-github-secrets.md`; use the Environment + broker flow above instead.
