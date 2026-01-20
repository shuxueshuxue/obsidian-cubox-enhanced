# Development Notes

## Known Issue: Sync Flag Stuck

Symptom:
- Manual sync logs only “manual sync started” and stops.

Cause:
- The `syncing` flag can remain `true` if Obsidian crashes or the plugin reloads mid-sync.

Fix:
- Toggle the plugin off/on, or edit `.obsidian/plugins/obsidian-cubox/data.json` and set `"syncing": false`.

Status:
- Not implemented as logic; documented as a recovery step.
