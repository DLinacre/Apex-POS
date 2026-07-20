# Changelog

All notable changes to Apex POS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0] — 2026-07-20

### Added
- Complete point-of-sale register with product grid, cart, discounts, and tax calculation
- Sales history with refund capability and invoice search
- Inventory management with CSV import/export
- Customer directory with loyalty points tracking
- Expense tracking with categorization and profit reporting
- NFC tag support for employees, customers, and products (Web NFC API on Android)
- Desktop NFC simulator for testing without hardware
- Google Sign-In integration (opt-in, requires Client ID)
- Dark mode toggle with localStorage persistence
- Full offline support via service worker (app shell + CDN caching)
- PWA manifest for installability
- Responsive design (mobile drawer, tablet, desktop)
- 80mm thermal receipt printing layout
- Database backup/restore (JSON export/import)
- Demo data seeder with sample products, customers, expenses, and sales history
- Comprehensive security: CSP meta tag, SRI hashes on all CDNs, SameSite cookies
- WCAG accessibility: focus-visible outlines, reduced-motion support, 44px touch targets

### Technical
- Vue 3 (global build, no build step required)
- Dexie.js over IndexedDB for client-side persistence
- Chart.js for sales reporting charts
- Tailwind CSS (CDN runtime, dark-mode aware)
- Service worker with stale-while-revalidate strategy
- All dependencies version-pinned with Subresource Integrity

## [1.0] — 2026-01-15

### Added
- Initial release of Apex POS
- Basic register functionality
- Product management
- Customer profiles
