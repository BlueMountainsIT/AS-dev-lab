# Local Mac setup — AS-dev-lab

Practical steps for Alfred (or anyone) working on **BlueMountainsIT/AS-dev-lab** on a Mac with GitHub SSH and optional 1Password + Cursor worker.

## Clone the repo

```bash
git clone git@github.com:BlueMountainsIT/AS-dev-lab.git ~/AS-dev-lab
cd ~/AS-dev-lab
```

If you already cloned via HTTPS, switch to SSH:

```bash
cd ~/AS-dev-lab
git remote set-url origin git@github.com:BlueMountainsIT/AS-dev-lab.git
git remote -v
```

## Test GitHub SSH

```bash
ssh -T git@github.com
```

You should see a success message naming your GitHub user. With 1Password as the SSH agent, expect an approval prompt.

### `ssh-add -l` shows no identities

That is **normal** when using the **1Password SSH agent**. Keys live in 1Password, not in `ssh-add`. If `ssh -T git@github.com` works, SSH is configured correctly.

## 1Password SSH agent (recommended)

1. 1Password → **Settings → Developer** → **Use the SSH agent**.
2. Add/configure your GitHub key for the SSH agent in 1Password.
3. In `~/.ssh/config`:

```
Host github.com
  IdentityAgent "~/Library/Group Containers/2BUA8C4S2C.com.1password/t/agent.sock"
```

Then:

```bash
cd ~/AS-dev-lab
git fetch origin
git pull origin main
```

## Test push (optional)

```bash
git commit --allow-empty -m "Test local SSH push"
git push origin main
```

You should get a 1Password authorize prompt if the agent is in use.

## Cursor CLI + worker (optional)

Run cloud/Project agents on your Mac (same machine as 1Password):

1. **Command Palette** → **Shell Command: Install 'cursor' command in PATH**.
2. Terminal:

```bash
cursor worker start
```

Keep the worker running while agents use your machine.

## Cloud vs local

| Where | Typical `origin` | 1Password prompt? |
|-------|------------------|-------------------|
| Cursor cloud VM | `https://github.com/...` | No |
| Your Mac | `git@github.com:...` | Yes (with 1Password agent) |

More detail: see project docs on 1Password SSH testing in the Agent Store (`docs/1password-ssh-git-test.md`).
