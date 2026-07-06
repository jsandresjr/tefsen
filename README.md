# Tefsen Website

Production-ready static website for `tefsen.com`, designed for GitHub Pages.

## Protected public routes

Keep these paths available when deploying:

- `/privacy.html`
- `/delete-account.html`
- `/delete-account/`
- `/CNAME`

The package preserves the current published privacy-policy text and account-deletion information from the public Tefsen repository at build time.

## Main files

- `index.html` — redesigned public homepage
- `css/home.css` — homepage design and responsive layout
- `js/home.js` — mobile navigation, sticky header, reveal animation
- `css/style.css` — lightweight styling used by legal pages
- `404.html` — GitHub Pages 404 page
- `robots.txt` and `sitemap.xml` — SEO basics
- `assets/` — Tefsen logo and favicon

## Deploy to GitHub Pages

1. Back up your current repository.
2. Upload the contents of this folder to the repository root.
3. Do not delete `CNAME`.
4. Commit changes to `main`.
5. In GitHub: **Settings → Pages → Deploy from a branch → main / root**.
6. Wait for GitHub Pages deployment to complete.
7. Test all protected routes before changing anything in Google Play Console.

## Before public launch

Update only claims that need to reflect current product status. The homepage deliberately avoids fake user/download statistics and does not claim that the Android app is publicly released.

## Firebase web app

This package is the public marketing website. A full authenticated web version should be deployed separately (recommended: `app.tefsen.com`) and connected to the same Firebase project with strict Firestore/Storage rules and privileged actions moved to trusted backend code.
