![Apex POS — Offline-First Point of Sale](assets/banner.png)

# Apex POS — Offline-First Point of Sale

[![Live App](https://img.shields.io/badge/Live-dlinacre.github.io%2FApex--POS-22c55e?style=flat-square)](https://dlinacre.github.io/Apex-POS/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](./LICENSE)
[![Offline-First](https://img.shields.io/badge/Offline--First-Service%20Worker-10b981?style=flat-square)](https://dlinacre.github.io/Apex-POS/)
[![No Server Required](https://img.shields.io/badge/Backend-None%20Needed-6366f1?style=flat-square)](https://github.com/DLinacre/Apex-POS)
[![Pinned + SRI](https://img.shields.io/badge/Dependencies-Pinned%20%2B%20SRI-f59e0b?style=flat-square)](#tech-stack)

**A complete point-of-sale system that runs entirely in the browser — no server, no cloud, no account.** Open it on a till, tablet or laptop and start selling: the whole database lives in IndexedDB on the device.

**[▶ Open the live app](https://dlinacre.github.io/Apex-POS/)**

---

## Features

| Area | What you get |
|---|---|
| 🧾 **Register** | Product grid with categories & search, cart with quantities and line discounts, customer attach, held/suspended orders, cash/card/mobile payments with change calculator |
| 🖨️ **Receipts** | 80 mm thermal-print-ready receipts (`@media print` layout), configurable header/footer, instant reprint from sales history |
| 📦 **Inventory** | Products, categories, SKU/barcode fields, cost vs retail margin, low-stock alerts against reorder points |
| 👥 **Customers** | Profiles with loyalty points, contact details, notes and purchase linkage |
| 💸 **Expenses** | Dated expense tracking by category and payment method, included in profit reporting |
| 📊 **Reports** | Revenue & profit charts (Chart.js), best-sellers, category mix — all computed locally |
| 🏷️ **NFC tags (experimental)** | Read/write customer, product and employee NFC tags via Web NFC on supported Android/Chrome devices |
| 👤 **Roles** | Manager & Cashier profiles with passcode sign-in and quick switch |
| 🌙 **UX** | Dark mode, responsive down to phone width, keyboard-focus visible, `prefers-reduced-motion` support |
| 📴 **Offline** | Service worker makes the entire app load and trade with zero connectivity after first visit |

## Quick start

**Use it now (zero install):** <https://dlinacre.github.io/Apex-POS/>

**Run locally:**

```bash
git clone https://github.com/DLinacre/Apex-POS.git
cd Apex-POS
python3 -m http.server 8080        # any static server works
# open http://localhost:8080
```

> No build step, no `npm install`. `index.html` + `styles.css` + `db.js` + `app.js` is the whole app.

### Demo credentials & data

On first run the app seeds a demo store (products, customers, expenses and 10 days of sales history).

| Name | Role | Demo passcode |
|---|---|---|
| Admin Manager | Manager | `1234` |
| Emma Watson | Cashier | `5555` |
| Liam Neeson | Cashier | `7777` |

⚠️ **Demo-only security:** passcodes are plain text in your local database and exist to demonstrate role switching — replace/remove them (Settings → Staff) before using Apex POS with real data. Reset everything any time with **Settings → Reset & reseed demo data**.

## Configuration

All store settings (name, address, currency, VAT/tax rate, receipt header/footer, low-stock threshold) live in the in-app **Settings** view and persist in IndexedDB.

**Google Sign-In (optional):** SSO is disabled unless you paste your own Google OAuth Client ID into *Settings → Google Client ID*. Only then is the Google Identity Services script loaded — nothing Google's way otherwise.

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| UI | Vue 3 (global build) | reactivity without a build step |
| Styling | Tailwind CSS + small custom sheet | dark-mode aware |
| Database | Dexie.js over IndexedDB | all data stays on-device |
| Charts | Chart.js | local reporting only |
| Offline | hand-rolled service worker | app shell + CDN runtime cache |
| Security | version-pinned CDNs with Subresource Integrity, CSP meta, `SameSite=Lax; Secure` cookies | see [SECURITY.md](./SECURITY.md) |

Dependency versions are **pinned with SRI hashes** on purpose: the app she runs the same code in five years that it runs today — verify the hashes with `openssl dgst -sha384 -binary file | openssl base64 -A`.

## Privacy

Everything you sell, stock or expense never leaves the browser. There are no analytics, no trackers and no cookies except a benign session marker. The only external requests are the pinned framework CDNs, optional Google SSO, and demo product images (Unsplash) which you can replace in your own data.

## Scope & compliance notes

Apex POS is a full-featured demo/starter POS. It is **not** a certified payment device and is intentionally out of PCI DSS scope (no cardholder data is captured). VAT/tax figures are simple configurable rates, not jurisdiction-specific tax advice.

## Roadmap

- [ ] Barcode scanner support (WebHID / camera)
- [ ] CSV import/export for products & sales
- [ ] Multi-till device sync (opt-in)
- [ ] Receipt logo upload
- [ ] Compiled-Tailwind production stylesheet (remove runtime JIT)

Contributions welcome — open an issue or PR.

## License

[MIT](./LICENSE) © 2026 David Linacre
