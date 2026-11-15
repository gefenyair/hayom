# Homepage scanner setup

The viewer is at https://gefenyair.github.io/hayom/scanner/ and the archive lives in Google Drive folder 1gX67FxPQmA8NXrFD9HYkLemCLcE7dUF3.

The workflow runs hourly at minute 05 UTC and captures only Israel local hours 06:00-23:00 and 00:00 (19 captures per calendar day; 00:00 is assigned to its own date). GitHub Actions scheduling is best-effort, not exact.

## OAuth setup

1. In Google Cloud Console create a project, enable Google Drive API, configure OAuth consent screen, and create OAuth client credentials. Authorize the Drive file scope or appropriate Drive scope for the target folder.
2. Obtain a refresh token for the Google account owning the destination Drive folder using an OAuth flow with offline access. Keep it private.
3. In repository Settings > Secrets and variables > Actions, add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REFRESH_TOKEN. Never commit these values.
4. In repository Settings > Actions > General, allow workflows to read and write repository contents.
5. In Google Drive, share the screenshot folder for viewing as desired. Public access exposes all screenshots in it.
6. Run the Homepage scanner workflow manually once, inspect its logs and verify an image appears in Drive and the manifest.

The viewer loads the Google Drive file preview in an iframe; verify that public sharing and iframe rendering work in the deployed site. If previews fail, use an image-serving proxy or direct media delivery. This integration has not yet been end-to-end tested.

## Limitations

This does not yet send daily email. Screenshots of very long pages can hit Chromium limits, and consent overlays, lazy-loaded sections and animated components may affect capture quality. The workflow stores a single WebP per hour; retention is unlimited subject to Drive quota. OAuth credentials are necessary for unattended writes.
