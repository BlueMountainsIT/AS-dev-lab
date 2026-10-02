# Team workflow — Cloud agent branch, Mac 1Password push, broker deploy

**Team default:** Cursor Project agents implement changes on the cloud VM and commit to a feature branch named `cursor/<short-topic>`. They **do not** push to `main` from the cloud when following this workflow. A human on a Mac merges that branch locally and pushes `main`, which triggers deploy with secrets from 1Password Credential Broker.

For what happens after `main` is updated on GitHub, see [Deploy — 1Password Credential Broker + GitHub Actions](./deploy-1password-github.md).

## End-to-end flow (prose diagram)

```
User (Mac)                    Cloud Project agent              GitHub                    GitHub Actions + 1Password
    |                                  |                          |                              |
    |  Ask for a change                |                          |                              |
    |------------------------------->  |                          |                              |
    |                                  |  Implement, commit       |                              |
    |                                  |  branch cursor/<topic>   |                              |
    |                                  |  push branch (not main)  |                              |
    |                                  |------------------------> |                              |
    |  Agent reports branch name       |                          |                              |
    |  <-------------------------------|                          |                              |
    |                                  |                          |                              |
    |  git fetch / merge / push main   |                          |                              |
    |  (1Password SSH for git push)  |                          |                              |
    |----------------------------------------------------------------> |                              |
    |                                  |                          |  push to main                |
    |                                  |                          |----------------------------> |
    |                                  |                          |                              |  deploy.yml
    |                                  |                          |                              |  OIDC → 1Password Broker
    |                                  |                          |                              |  load env → Vercel deploy
```

**Steps in order**

1. **Request** — You ask the Project agent for a change (feature, fix, docs).
2. **Implement (cloud)** — The agent works in the cloud VM, commits on `cursor/<short-topic>`, and pushes **that branch** to `origin`. It does **not** push `main` as part of this workflow.
3. **Integrate (Mac)** — You fetch the branch, merge into local `main`, and `git push origin main`. Git uses your **1Password SSH agent** integration, so you authenticate at push time.
4. **Deploy (CI)** — The push to `main` runs [.github/workflows/deploy.yml](../.github/workflows/deploy.yml): Credential Broker loads app secrets from 1Password, then Vercel build and deploy. Details: [deploy-1password-github.md](./deploy-1password-github.md).

## Mac commands after the agent finishes

Replace `<short-topic>` with the branch the agent reported (e.g. `cursor/fix-login-button`).

```bash
cd /path/to/AS-dev-lab   # your local clone

git fetch origin
git checkout main
git pull origin main     # optional: sync main if others pushed

git merge origin/cursor/<short-topic>   # or: git merge cursor/<short-topic> if you fetched the branch locally

# Review the merge if you want:
git log -1 --stat
git diff origin/main..HEAD   # what you are about to push

git push origin main
```

If the merge has conflicts, resolve them on the Mac, commit the merge, then push.

**Doc-only exception:** Pure documentation changes may be pushed to `main` directly from the cloud agent when the team agrees; production code changes should still use branch → Mac merge → push.

## Forcing the 1Password SSH prompt

Pushes to GitHub over SSH should go through **1Password’s SSH agent** (not a long-lived key file on disk). If macOS reuses an existing agent session and you want to confirm identity:

1. **Lock 1Password** — Menu bar → lock vault, or `⌘⇧L` (depending on app version). Unlock when prompted; the next `git push` should ask you to authorize.
2. **Quit and reopen 1Password** — Clears some cached SSH signing sessions.
3. **Check SSH config** — `~/.ssh/config` should use the 1Password agent, for example:
   ```sshconfig
   Host github.com
     IdentityAgent "~/Library/Group Containers/2BUA8C4S2C.com.1password/t/agent.sock"
   ```
4. **Test SSH** — `ssh -T git@github.com` should still succeed after you approve in 1Password.

If push never prompts, verify in 1Password **Settings → Developer** that **Use the SSH agent** is on and your GitHub identity is linked to the SSH key 1Password manages.

## Why cloud agents must not push `main` (this workflow)

| Path | Git auth on push | Deploy trigger |
|------|------------------|----------------|
| **Mac → `git push origin main`** | Your 1Password SSH (human in the loop) | Yes — broker deploy |
| **Cloud agent → `git push origin main`** | Cloud environment credentials (no 1Password SSH on your Mac) | Yes — **bypasses** your Mac SSH gate |

Pushing `main` from the cloud still triggers the same GitHub Actions deploy (broker + Vercel). It does **not** use your Mac’s 1Password SSH prompt, so it skips the team’s intentional “human merges and pushes production line” step. Keeping agent work on `cursor/<short-topic>` preserves that control and a clear audit trail on your machine before production deploy.

## Future: self-hosted Cursor workers on the Mac

When the team enables **private / self-hosted workers**, an agent can run **`cursor worker start`** (or equivalent) on a trusted Mac. Git operations then execute on that machine with your normal SSH and 1Password setup—closer to “agent commits and you push,” or eventually push under your local agent session with the same prompts you use today. Until then, the cloud VM + Mac merge workflow above is the default.

## Related docs

- [Deploy — 1Password Credential Broker + GitHub Actions](./deploy-1password-github.md) — broker setup, Environment variables, and verify steps after `main` is pushed.
