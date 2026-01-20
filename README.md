# Cubox Daily Sync for Obsidian

A minimal Cubox sync plugin that appends new Cubox entries to today’s daily note.

## Features

- Auto sync on a timer (configurable in minutes)
- Manual command: “Sync Cubox to daily note”
- Link entries rendered with a template (default: `[{{title}}]({{url}})`)
- Memo/text entries append full content (no title)
- Image entries download to a local vault folder and embed locally

## Requirements

- Obsidian core **Daily Notes** plugin must be enabled

## Installation

### Install from the Community

1. Open Obsidian settings
2. Navigate to the “Community plugins” tab
3. Click “Browse” and search for “Cubox”
4. Click Install

### Manual Installation

1. Download the latest `main.js`, `manifest.json`, and `styles.css` from the release
2. Create `.obsidian/plugins/obsidian-cubox` in your vault
3. Copy the files into that folder
4. Enable the plugin in Obsidian settings

## Configuration

- **Cubox server domain**: `cubox.cc` or `cubox.pro`
- **Cubox API key**: paste the key or the full API link
- **Sync frequency (minutes)**: set to `0` to disable auto sync
- **Link template**: use `{{title}}` and `{{url}}`
- **Image folder**: vault path for downloaded images (default: `Cubox Images`)
- **Image embed width**: width for `![]()` embeds (default: `800`)

## Usage Notes

- New entries are appended only to **today’s** daily note
- Each card is appended once; later Cubox updates won’t duplicate it
- Image OCR text is ignored; only the image is embedded locally


## License

This project is licensed under the MIT License.
