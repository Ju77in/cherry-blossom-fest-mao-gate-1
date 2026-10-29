# Cherry Blossom Festival website · Mao Gate, Senapati

Static site + one Netlify Function. Text content is stored in Netlify Blobs; photos and videos live in Cloudinary.

- `public/index.html`: the public website
- `public/admin/index.html`: private organiser page (password protected), at `/admin`
- `netlify/functions/api.mjs`: the small backend (login, saving content, signing Cloudinary uploads)

## Netlify environment variables
| Name | What it is |
|---|---|
| `ADMIN_PASSWORD` | the organisers' shared password (long and unique) |
| `CLOUDINARY_CLOUD_NAME` | from your Cloudinary dashboard |
| `CLOUDINARY_API_KEY` | from Cloudinary → Settings → API Keys |
| `CLOUDINARY_API_SECRET` | same page. Keep it secret, never put it in the code |

**Handing over to next year's team:** change `ADMIN_PASSWORD` in Netlify and redeploy. Everyone gets signed out.
