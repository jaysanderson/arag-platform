# Storyboard — __PRODUCT_TITLE__

| Shot | Script cue | Page / action | Capture |
|---|---|---|---|
| S1 | 0:00 | `/` full page, idle | `01-home.png` |
| S2 | 0:15 | click `#create`; timeline active | `02-job-running.png` |
| S3 | 0:45 | notes table shows PROCESSED | `03-processed.png` |
| S4 | 1:00 | `#ask` → answer bubble | `04-answer.png` |
| S5 | 1:30 | `/admin/` sign-in → overview | `05-admin-overview.png` |
| S6 | 1:50 | admin config tab | `06-admin-config.png` |
| S7 | 2:00 | admin logs tab | `07-admin-logs.png` |
| S8 | 2:10 | `/api/v1/docs` | `08-docs.png` |

`make showcase` records `showcase/out/**/video.webm` (1280×800) plus the PNGs above via Playwright against the mock ARAG. Convert: `ffmpeg -i showcase/out/*/video.webm -c:v libx264 -pix_fmt yuv420p showcase/out/showcase.mp4`.
