# Contributing to Apex POS

Thank you for considering contributing to Apex POS! This document outlines the contribution guidelines.

## Code of Conduct

Please be respectful and constructive in all interactions.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/DLinacre/Apex-POS/issues)
2. If not, open a new issue with:
   - A clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Browser/device information
   - Screenshots if applicable

### Suggesting Features

1. Open a [feature request](https://github.com/DLinacre/Apex-POS/issues/new?template=feature_request.md)
2. Describe the problem you're solving, not just the solution
3. Explain how it helps Apex POS users

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly — Apex POS should work offline, online, in dark mode, and on mobile
5. Commit with clear messages
6. Open a PR against the `main` branch

### Development Setup

```bash
git clone https://github.com/DLinacre/Apex-POS.git
cd Apex-POS
python3 -m http.server 8080
# Open http://localhost:8080
```

No build step required. Edit `index.html`, `styles.css`, `app.js`, or `db.js` directly.

### Coding Guidelines

- Maintain offline-first architecture — no server dependencies
- Keep dependencies pinned with SRI hashes
- Use semantic HTML and ARIA attributes for accessibility
- Support both light and dark modes
- Test on mobile and desktop viewports
- Avoid adding analytics or trackers without explicit user opt-in

### Security

- Never commit credentials, API keys, or tokens
- Follow the principle of least privilege
- Report vulnerabilities privately via GitHub Security Advisories

## Questions?

Open a [discussion](https://github.com/DLinacre/Apex-POS/discussions) or issue.
