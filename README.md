# Article Hub

A simple website to **publish articles online** so anyone on the internet can read them — from any network or device.

Articles are stored in **[Supabase](https://supabase.com)** (free cloud PostgreSQL). Nothing is saved on your local computer.

## How it works

| Piece | Service | Cost |
|-------|---------|------|
| Database | Supabase PostgreSQL | Free tier |
| Hosting | Netlify / Vercel / GitHub Pages | Free |
| Auth | Supabase Auth | Free |

- **Readers** — open your public URL, no account needed
- **You (author)** — sign in, write an article, it saves to the cloud instantly

## Quick start (about 10 minutes)

### 1. Create a free Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up (free).
2. Click **New project**, pick a name and password, choose a region close to you.
3. Wait for the project to finish setting up.

### 2. Create the database table

1. In Supabase, open **SQL Editor** → **New query**.
2. Copy everything from `supabase/schema.sql` in this project and paste it.
3. Click **Run**. You should see “Success”.

### 3. Get your API keys

1. In Supabase, go to **Settings** → **API**.
2. Copy:
   - **Project URL** (e.g. `https://abcdefgh.supabase.co`)
   - **anon public** key (long string under Project API keys)

### 4. Configure this project

```powershell
copy js\config.example.js js\config.js
```

Edit `js/config.js` and paste your URL and anon key:

```javascript
window.SUPABASE_URL = "https://YOUR-PROJECT-ID.supabase.co";
window.SUPABASE_ANON_KEY = "your-anon-key-here";
```

### 5. Run locally

Because this is plain HTML/JS, you can open `index.html` in a browser — but some browsers block Supabase requests from `file://` URLs. Use a simple local server instead:

**Option A — Python (if installed):**
```powershell
cd "C:\Users\Josh Aaron\Projects\article-hub"
python -m http.server 8080
```
Then open http://localhost:8080

**Option B — VS Code / Cursor:** install the “Live Server” extension and click “Go Live”.

### 6. Create your author account

1. Open the site → **Sign in** → **Create one**.
2. Enter email + password (min 6 characters).
3. If Supabase asks you to confirm email, check your inbox (or disable email confirmation in Supabase → Authentication → Providers → Email for testing).

### 7. Publish your first article

1. Sign in → **Write**.
2. Add a title and content → **Publish**.
3. Your article is saved in Supabase and appears on the home page.

## Deploy so the world can read it

Deploy the entire `article-hub` folder to any free static host. After deploy, share the URL — people on any network can visit it.

### Netlify (easiest)

1. Go to [netlify.com](https://netlify.com) and sign up.
2. Drag the `article-hub` folder onto the Netlify dashboard (**Deploy manually**).
3. You get a URL like `https://random-name.netlify.app` — share that link.

### GitHub Pages

1. Push this folder to a GitHub repository.
2. Repo **Settings** → **Pages** → Source: main branch, folder `/ (root)`.
3. Your site will be at `https://YOUR-USERNAME.github.io/REPO-NAME/`.

> **Note:** Make sure `js/config.js` exists with your Supabase keys before deploying. The anon key is safe to use in the browser (Supabase designed it that way). Row-level security in `schema.sql` protects your data.

## Project structure

```
article-hub/
├── index.html          # Home — list of articles
├── article.html        # Single article view
├── publish.html        # Write & publish (requires sign-in)
├── login.html          # Author sign-in / sign-up
├── css/style.css
├── js/
│   ├── config.example.js
│   ├── config.js       # Your Supabase keys (create from example)
│   ├── app.js          # Shared helpers
│   ├── home.js
│   ├── article.js
│   ├── login.js
│   └── publish.js
└── supabase/schema.sql # Run once in Supabase SQL Editor
```

## Security notes

- Only **signed-in users** can publish (enforced by Supabase Row Level Security).
- **Everyone** can read articles (public blog behavior).
- Never put your Supabase **service_role** key in this project — only the **anon** key belongs in the browser.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| “Setup required” on page | Create `js/config.js` from the example file |
| “Failed to fetch” locally | Use `python -m http.server` instead of opening the file directly |
| Can’t sign up | Check Supabase → Authentication → Providers → Email is enabled |
| Email confirmation blocking login | Confirm email, or disable “Confirm email” in Supabase auth settings for testing |

## License

MIT — use freely for learning and personal projects.
