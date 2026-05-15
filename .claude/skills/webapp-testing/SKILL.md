---
name: webapp-testing
description: "Toolkit for interacting with and testing local web applications using Playwright. Supports verifying frontend functionality, debugging UI behavior, capturing browser screenshots, and viewing browser logs."
---

# Web Application Testing

Write native Python Playwright scripts when testing local web apps.

## Decision Tree

- Static HTML file? → Use `file://` URLs directly
- Dynamic webapp with server? → Use `with_server.py` helper
- Server already running? → Write Playwright script targeting the URL directly

## Reconnaissance-Then-Action Pattern

1. **Inspect DOM** — via screenshot, `page.content()`, or locator queries
2. **Identify selectors** — from inspection results
3. **Execute actions** — with discovered selectors

## Best Practices

- Use `sync_playwright()` for synchronous scripts
- Always close the browser in a `finally` block
- Use descriptive selectors: `text=`, `role=`, CSS selectors, or IDs
- Add appropriate waits via `page.wait_for_selector()` or `page.wait_for_timeout()`
- Don't inspect DOM before waiting for `networkidle` on dynamic apps
- Import: `from playwright.sync_api import sync_playwright`

## Example Script Pattern

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("http://localhost:5173")
    page.wait_for_load_state("networkidle")
    # ... interactions and assertions ...
    browser.close()
```
