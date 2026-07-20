# Security Policy

## Reporting a Vulnerability
Report vulnerabilities **privately** via GitHub Security Advisories for this repository
(Security tab → "Report a vulnerability") or via the maintainer's GitHub profile.

## Important context
- Apex POS runs 100% client-side; all data stays in the browser's IndexedDB. There is no server
  side to attack, and nothing is transmitted unless you configure the optional Google SSO.
- The bundled demo cashiers use well-known demo passcodes (1234 / 5555 / 7777) stored in plain
  text in IndexedDB. This is a **demo convenience**, not an authentication boundary suitable for
  production retail. Replace these before any real-world use.
- Apex POS is not a certified payment device and is not in PCI DSS scope (no card data touches
  the app). Do not enter real cardholder data into any field.

## Dependency policy
Framework CDNs are version-pinned with Subresource Integrity hashes. Dependabot-style manual
review is required before bumping them.
