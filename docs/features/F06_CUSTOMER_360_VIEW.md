# F06_CUSTOMER_360_VIEW — trusted facility profile

> Goal: "Hospital Alpha — São Paulo" profile: equipment by modality with qty, age range, confidence, freshness + drill-down to observations. Jury: Track1 Customer-360 + MVP customer view.

## Frontend alone
- Screen 03 (see `ui-ux-plan/SCREEN_03_CUSTOMER_360.html`): header (facility/city/country, last-verified), table `MR 3 · 4–10y · High`, expandable history (who/when/source), photo thumbnails, model cards, disclaimer footer. Renders from SQLite cache offline.

## Backend alone
- `GET /api/customers/:id/360/` aggregates items across visits: roll up qty, age min–max, dominant confidence, max freshness. Pure ORM arithmetic.

## Together
Phone computes nothing new here — it renders server aggregate when online, local aggregate when offline; both share the same roll-up rules (documented once, implemented twice, tested against seed).

## Acceptance (P0)
- [ ] Canonical Alpha record renders the Track1 example table shape.
- [ ] Drill-down shows individual observations + timestamps.
- [ ] Offline = same view from cache.
