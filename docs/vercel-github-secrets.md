# Vercel deploy — GitHub secrets (deprecated)

**Use [deploy-1password-github.md](./deploy-1password-github.md)** for the current setup: 1Password Credential Broker loads deploy secrets at runtime; GitHub only stores `OP_INTEGRATION_KEY` (org secret) and `OP_WORKLOAD_ID` / `OP_ENVIRONMENT_ID` (variables).

The previous approach — ten repository secrets (`VERCEL_*`, `SUPABASE_*`, `AUTH0_*`) configured at [repository Actions secrets](https://github.com/BlueMountainsIT/AS-dev-lab/settings/secrets/actions) — is a deprecated fallback if broker integration is unavailable. See the “Deprecated fallback” section in the 1Password doc.
