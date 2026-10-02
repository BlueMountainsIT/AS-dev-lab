# Vercel deploy — GitHub Actions secrets

The **Deploy to Vercel** workflow (`.github/workflows/deploy.yml`) runs on every push to `main`. It needs repository secrets before it can sync env vars to Vercel and deploy.

Secret values for Dev Lab work live in the **1Password Environment** for the current Dev Lab session. Copy from there; do not paste production values into chat or commit them to the repo.

## 1. Create a Vercel token

1. Sign in at [vercel.com](https://vercel.com).
2. Open **Account Settings** (avatar menu) → **Tokens** (or go to [vercel.com/account/tokens](https://vercel.com/account/tokens)).
3. **Create Token** — name it something like `AS-dev-lab GitHub Actions`, scope as needed for the team/project, copy the token once (you will not see it again).

This becomes **`VERCEL_TOKEN`** in GitHub.

## 2. Get Vercel org and project IDs

1. In the Vercel dashboard, open the **AS-dev-lab** project (or the project linked to this repo).
2. Go to **Settings** → **General**.
3. Copy:
   - **Team / Org ID** → **`VERCEL_ORG_ID`**
   - **Project ID** → **`VERCEL_PROJECT_ID`**

If IDs are not visible on General, use **Settings** → **General** scroll to **Project ID**, and for the team ID check **Team Settings** → **General** for the team that owns the project.

## 3. Add secrets in GitHub

Open repository secrets for this repo:

**https://github.com/BlueMountainsIT/AS-dev-lab/settings/secrets/actions**

For each name below, click **New repository secret**, use the **exact** name, and paste the value from 1Password Environment (Dev Lab session) or from the steps above.

| Secret name | Source |
|-------------|--------|
| `VERCEL_TOKEN` | Vercel token (step 1) |
| `VERCEL_ORG_ID` | Vercel project/team settings (step 2) |
| `VERCEL_PROJECT_ID` | Vercel project settings (step 2) |
| `SUPABASE_URL` | 1Password Environment |
| `SUPABASE_ANON_KEY` | 1Password Environment |
| `AUTH0_SECRET` | 1Password Environment |
| `AUTH0_BASE_URL` | 1Password Environment |
| `AUTH0_ISSUER_BASE_URL` | 1Password Environment |
| `AUTH0_CLIENT_ID` | 1Password Environment |
| `AUTH0_CLIENT_SECRET` | 1Password Environment |

Names must match **exactly** — the deploy job fails at the start and lists any missing names if one is empty or not configured.

## 4. Verify

Push to `main` or re-run the latest **Deploy to Vercel** workflow. The first step **Verify required secrets** should pass; later steps install dependencies, sync env to Vercel, build, and deploy.

If deploy fails on the verify step, fix the listed secret names in GitHub and run the workflow again.
