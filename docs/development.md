# Development

## Commands

```bash
make install   # sync into ~/.local/share/gnome-shell/extensions/
make reload    # re-enable; on Wayland, log out/in for JS changes
make prefs     # open preferences
make status    # extension info
make zip       # build upload zip
```

See [prd.md](../prd.md) for product scope and acceptance criteria.

## Publishing

### One-time setup (GitHub Actions → EGO)

1. Create an account at https://extensions.gnome.org/ (username + password; OAuth-only may not work for the API).
2. In the GitHub repo: **Settings → Secrets and variables → Actions**, add:
   - `EGO_USERNAME` - your EGO username
   - `EGO_PASSWORD` - your EGO password
3. Push these workflow files to `main`, then release with a tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

That runs [.github/workflows/release.yml](../.github/workflows/release.yml): builds the zip, creates a GitHub Release, and uploads to EGO via [scripts/ego-upload.sh](../scripts/ego-upload.sh).

You can also run the workflow manually: **Actions → Release → Run workflow**.

EGO still reviews each upload by hand. Screenshots are added on your extension page after the first listing exists.

### Manual upload

```bash
make zip
# then https://extensions.gnome.org/upload/
```

### Package a zip locally

```bash
make zip
```

This builds `promptkey@drowhann.github.io.shell-extension.zip`.
