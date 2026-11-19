# Display rules

Gelatin's roster is shown on many apps. These rules keep a DJ's numbers honest everywhere they appear. They apply to this app's own screens, whatever they look like.

## Draw

`dj.draw` is how many people came to the DJ's recent nights, counted by the venue.

- Show it as a range with its window: "Draw 180–260 · avg 215 · last 90 days". Never one number on its own, and never round it into a single figure.
- When `dj.draw` is null, show "Not yet established". Never show 0, a dash that reads as zero, or hide the line so the DJ looks like they have a number.
- Label it as venue-confirmed when you label it at all. Never call it followers, fans or reach.

## Tier

- Show `dj.tier` as Gelatin issued it: `verified` is "Verified", `top_performer` is "Top performer", `resident` is "Resident", `city_pillar` is "City pillar".
- Never rank, recolor or rename tiers, and never invent a tier for a DJ.

## Rate

- When `dj.published_rate_cents` is a number, show it as the DJ's rate, formatted from cents.
- When it is null, show no rate and no price hint at all. Invite an offer instead.
- Start an offer at the published rate when there is one. Going under it is allowed: say so, don't block it.

## Availability

- Show "Open" or "Not free" for a night. Never say why a DJ isn't free, and never guess.
- A day `gelatin.getDjAvailability(...)` didn't return is unknown, not open.

## Public pages

On any page the public can see, such as an event page:

- Use `gelatin.getEventLineup(eventId)` only, never the status feed.
- Show no prices, fees, offers, holds or totals.
- Show only confirmed DJs by name. A pending DJ may still say no: show an unnamed slot, or nothing.
- Link each DJ to their `profile_page_url`.

## Profiles

- `gelatin.getDj(djId)` never returns contact details, and text that looked like one arrives as `[removed]`. Show it as it comes. Never add a way to contact the DJ outside Gelatin.
- Reviews carry words, a day and a venue, never who wrote them. Don't add a reviewer's name.
- When a section is empty, leave it out. A new DJ should never read as a row of zeros.

## Money

- Every amount comes from Gelatin: `session.total_cents`, the quote, or a cancellation preview. Never add up a fee, a percentage or card processing.
- A card hold is "held", not "charged" or "paid", until the status is `confirmed`.
- A released hold is "released", not "refunded".
- After a cancellation, say what happened to the money, from the preview the organizer confirmed: "Hold released" when `hold_released` is true, otherwise the refund and what the DJ keeps. "Cancelled" alone isn't enough.

## Credit

Near a list of Gelatin's DJs, say where they come from, for example "DJs, availability and rates from Gelatin".
