# Agent instructions — AS-dev-lab

## Git and deploy (required)

Follow [docs/workflow-mac-1p-push-broker-deploy.md](docs/workflow-mac-1p-push-broker-deploy.md).

1. **Never commit directly on `main`** for app or UI changes. Work on `cursor/<short-topic>` (e.g. `cursor/more-ambient-sprites`).
2. **Never push `main`** from the cloud agent. Pushing `main` skips the Mac 1Password SSH gate and does not match team workflow.
3. **Do push the feature branch** to `origin` when possible so the developer can merge on the Mac.
4. **Remote:** use SSH — `git@github.com:BlueMountainsIT/AS-dev-lab.git` — not HTTPS, so Mac pushes go through 1Password’s SSH agent.

After the agent finishes, the developer on Mac:

```bash
git fetch origin
git checkout main
git pull origin main
git merge origin/cursor/<short-topic>
git push origin main   # 1Password SSH prompt → GitHub Actions → Vercel
```

Doc-only changes may go to `main` on the branch workflow above or by direct Mac push when the team agrees.
