# Economic calendar sources

The terminal calendar loads scheduled U.S. releases from two free, official, keyless feeds:

- [Bureau of Labor Statistics iCalendar](https://www.bls.gov/help/hlpiCAL.htm) (`bls.ics`): release titles and Eastern release times. The provider converts these to UTC using `America/New_York`, including daylight-saving changes.
- [Bureau of Economic Analysis machine-readable schedule](https://www.bea.gov/news/schedule/icalendar) (`release_dates.json`): release titles and UTC timestamps.

The default calendar calls both feeds from the server. FRED and Finnhub remain optional when their keys are configured; the unavailable Treasury endpoint and hand-maintained central-bank dates are excluded from the default. Source health is shown in the panel. A failed response is not cached as an empty calendar, so a later request can recover.

These feeds publish schedules, not consensus forecasts or observed release values. Actual, forecast, and previous fields stay blank unless a configured source supplies verified values. The calendar currently covers U.S. releases by default; other currencies require a configured multi-country source.

Live verification on 2026-09-23: Workers version `cd7ae6c4-2f9c-45ec-9d21-d06c5e6e08cf` returned 11 events for the default two-week window, with both BLS and BEA healthy. `node scripts/verify-live-production.js` checks the API and a rendered calendar row as well as the terminal regression suite.
