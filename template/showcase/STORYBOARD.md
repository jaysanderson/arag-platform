# Storyboard — __PRODUCT_TITLE__

| Shot | Script cue | Page / action | Capture |
|---|---|---|---|
| S1 | 0:00 | `/` overview, idle | `01-overview.png` |
| S2 | 0:20 | *New note* drawer open | `02-new-note-drawer.png` |
| S3 | 0:40 | `/notes/{id}` record, Overview tab | `03-note-record.png` |
| S4 | 0:55 | Processing tab, stepper active | `04-processing.png` |
| S5 | 1:15 | Ask this note → grounded answer | `05-grounded-answer.png` |
| S6 | 1:40 | `/notes` list | `06-notes-list.png` |
| S7 | 1:50 | row selected, bulk bar visible | `07-bulk-bar.png` |
| S8 | 2:00 | `/settings` | `08-settings.png` |
| S9 | 2:15 | `/admin/` sign-in card | `09-operator-signin.png` |
| S10 | 2:18 | admin overview (health + usage) | `10-admin-overview.png` |
| S11 | 2:24 | admin jobs, detail pane | `11-admin-jobs.png` |
| S12 | 2:28 | admin logs | `12-admin-logs.png` |
| S13 | 2:32 | `/api/v1/docs` | `13-api-docs.png` |

`make showcase` records `showcase/out/**/video.webm` (1280×800) plus the PNGs above via Playwright against the mock ARAG. Convert: `ffmpeg -i showcase/out/*/video.webm -c:v libx264 -pix_fmt yuv420p showcase/out/showcase.mp4`.
