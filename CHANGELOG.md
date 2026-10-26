# Changelog

All notable changes to Mise are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-10-26

First public release.

### Added

- Windows desktop build (NSIS installer and portable `.exe`) with an embedded
  PGlite database stored in `%APPDATA%\Mise\data`.
- Dashboard with today's open tickets, open orders, covers and paid revenue.
- Kitchen board with queued → preparing → ready → served columns per station.
- Orders: create, edit, add items, fire to kitchen per station, settle or cancel.
- Menu management with categories, prices, stations and sold-out toggle.
- Floor tables grouped by zone with status cycling.
- Editable ticket codes: `PREFIX-YYMMDD-NNN`, day-scoped and atomically allocated.
- Settings for the kitchen code prefix and next-code preview.
- Offline-first Express API and React web app served from a single port.
- MIT license.

[0.1.0]: https://github.com/zakariaelqannaa-dv/resto-management/releases/tag/v0.1.0
