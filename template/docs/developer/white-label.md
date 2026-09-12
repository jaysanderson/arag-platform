# White-labelling this product

Every visible brand element is configuration. Set the `BRAND_*` variables (see `.env.example`), place an optional logo at `$DATA_DIR/branding/logo.svg`, restart, and confirm at `GET /api/v1/branding`. Attribution obligations: keep `LICENSE` and `NOTICE`; "Progress Agentic RAG" is a Progress Software trademark — the powered-by credit can be hidden but the platform may not be misrepresented.

| Variable | Effect |
|---|---|
| `BRAND_PRODUCT_NAME` | Header, page title, admin |
| `BRAND_TAGLINE` | Header tag |
| `BRAND_LOGO_URL` | Logo left of the name |
| `BRAND_PRIMARY_COLOR` / `BRAND_ACCENT_COLOR` | UI kit colour tokens |
| `BRAND_POWERED_BY` | `0` hides the Progress band and footer credit |
| `BRAND_FOOTER_TEXT` | Footer left text |
| `BRAND_DOCS_URL` / `BRAND_SUPPORT_URL` | Links in the band |
