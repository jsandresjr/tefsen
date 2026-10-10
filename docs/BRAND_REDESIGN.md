# Tefsen Brand Website — October 2026

This change turns the public homepage at `/` and the founder page at `/founder.html` into a black-and-white commercial **Tefsen** brand presence. It does not market Tefsen as a student platform, school or photo/video editor.

## What changed
- `index.html`: new brand-first homepage, metadata and founder feature.
- `founder.html`: refreshed biography, preserved founder name, portrait, existing public profile and GitHub link.
- `css/brand.css`: shared responsive monochrome styling, typography and motion.
- `js/brand.js`: navigation, scroll progress, reveal effects, year and optional pointer movement.
- Existing `css/home.css`, `css/founder.css`, `js/home.js` and app files remain in git for historical and app continuity; new pages do not load the old styles/scripts.

## Protected paths — do not delete or redirect
- `/privacy-policy/`: app privacy policy. **Content preserved unchanged**.
- `/privacy.html`: legacy privacy redirect. **Preserved unchanged**.
- `/delete-account/`: account deletion. **Content preserved unchanged**.
- `/delete-account.html`: legacy redirect. **Preserved unchanged**.
- `/terms.html`: terms. **Content preserved unchanged**.
- `/app/`: old authenticated web app. **Preserved unchanged, not advertised on the brand site**.
- `/CNAME`: www.tefsen.com domain configuration. **Preserved unchanged**.

## Deployment
The site uses GitHub Pages from main/root. Review this change before merging. Verify `/`, `/founder.html`, `/privacy-policy/`, `/privacy.html`, `/delete-account/`, `/delete-account.html`, `/terms.html`, and `/app/` after merging.

## Founder / contact
Founder identity is Js Andres Jr, based on the existing founder page. The existing portrait is `/assets/js-andres-jr.jpg`. Founder facts and external profile links are retained without education-specific marketing copy. The business email is `developer@tefsen.com` as in the repository.

## Accessibility
- Keyboard navigation, skip link, ARIA-expanded mobile menu and ESC closing.
- Scroll reveal content remains visible when JavaScript or IntersectionObserver is unavailable.
- Animations respect `prefers-reduced-motion`.
- High-contrast black/white sections and responsive layout.

No external JavaScript dependencies are required. Google Fonts can fall back to system sans-serif fonts.
