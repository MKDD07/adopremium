# adopremium

Add villa files with any filename (for example `Heaven Farm.json`) under
`assets/data/location/`. A villa needs a `title` or `name` and villa details
such as `location`, `rooms`, `spaces`, or `capacity`. Its location data determines
where it appears in the portfolio. Refresh the page after changes.

Servers with directory listings detect new JSON files automatically. For static
hosting without directory listings, run `python3 sync_location_manifest.py`
after adding, renaming, deleting, or editing files and before uploading. This
updates both the file index and the bundle used when opening the HTML directly.
Individual JSON files are fetched fresh on HTTP servers.
