# WEBmake

A portfolio site with a built-in editor, hosted free on GitHub Pages.

- `index.html` — the public site. Reads everything from `site.json`.
- `admin.html` — the editor. Change content, arrange layouts, upload images, then press **Publish**.
- `site.json` — all your content and settings.
- `images/` — your artwork. The editor uploads here for you.

## What it does

- **Galleries.** Grid (cropped thumbnails: square, portrait, landscape) or masonry (uncropped). 2–5 columns.
- **Lightbox.** Click any image: arrow keys, swipe on phones, Esc to close.
- **Home page.** Category tiles with titles over them (like Derek Charm), or straight into your first gallery.
- **Menu.** Along the top, or down the left side (like Gloria Félix).
- **Grid pages (like Squarespace).** Place text, images, buttons, and social icons on a 24-column grid. The layout scales with the window, so it keeps its arrangement at any desktop size. Phones get their own 8-column arrangement. It's made automatically, and you can rearrange it.
- **Contact.** A Contact page with an "Email me" button, plus Instagram and ArtStation icons.

## One-time setup

### 1. Turn on GitHub Pages

1. Go to the repo on GitHub → **Settings** → **Pages**.
2. Under **Build and deployment**, pick **Deploy from a branch**.
3. Choose branch **main**, folder **/ (root)**, then **Save**.
4. After a minute your site is at `https://<your-username>.github.io/WEBmake/`.

GitHub Pages is free for public repos. A private repo needs a paid GitHub plan for Pages.

### 2. Make an access token for the editor

The editor saves to GitHub using a token. Make one that can only touch this repo:

1. Open <https://github.com/settings/personal-access-tokens/new>.
2. **Token name:** `WEBmake editor`. **Expiration:** your choice. When it expires, make a new one.
3. **Repository access:** *Only select repositories* → pick **WEBmake**.
4. **Permissions** → **Repository permissions** → **Contents** → **Read and write**.
5. **Generate token** and copy it. It starts with `github_pat_`.

### 3. Connect the editor

1. Open `https://<your-username>.github.io/WEBmake/admin.html`.
2. In **GitHub connection**, enter owner (your username), repo (`WEBmake`), branch (`main`) and paste the token.
3. Click **Connect**.

By default the token is forgotten when you close the tab. Tick **Remember token on this device** only on your own computer.

Note: every GitHub Pages site under your account shares the same browser storage. A remembered token can be read by any of your other Pages sites (e.g. CORKBORK-app). That's fine while they're all your own code.

## Using the editor

- **Galleries:** drop images onto a gallery. They're resized automatically: 2560px for the lightbox, smaller for the grid. Drag rows to reorder. ☆ sets the cover used on the home page tile.
- **Pages & layout:** pick a page, then click blocks in the preview.
  - Drag a block to move it.
  - Drag its corner square to resize.
  - Arrow keys nudge it one cell. Shift + arrows resize it.
  - Delete/Backspace removes it.
  - Switch the preview to **Phone** to arrange the phone layout. It's saved separately from desktop.
- **Publish** saves everything to GitHub in one commit. The live site updates about a minute later.
- **More → Download backup** saves a copy of `site.json`.

The editor page is public, but it can't change anything without your token.

## Running the tests

```sh
npx http-server -p 8765 -s -c-1 . &
NODE_PATH=$(npm root -g) node e2e.js
```

The tests drive the site and editor in a real browser. GitHub is faked, so nothing gets published.
