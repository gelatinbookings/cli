# The partner API, call by call

Checked against the partner SDK `v0.1.0-alpha.10`. Install exactly that tag:

```sh
npm install github:gelatinbookings/gelatin-partner-sdk#v0.1.0-alpha.10
```

Every call is also plain HTTPS and JSON, described in the OpenAPI file in the SDK's `openapi/` folder, so a backend that isn't JavaScript can call it directly with `Authorization: Bearer <key>`.

## The journey

```ts
import { gelatin } from "@/lib/gelatin"; // the server module from SKILL.md

// 1. Who is free in this city on this night.
const page = await gelatin.listDjs({ city: "Atlanta, GA", date: "2026-11-14", available: true });

// 2. The organizer's offer, one entry per DJ. Charges nothing.
const booking = await gelatin.submitBookingRequests({
  external_event_id: event.id,
  organizer: { external_user_id: user.id, email: user.email },
  event: {
    name: event.name,
    starts_at: "2026-11-14T22:00:00-05:00",
    ends_at: "2026-11-15T02:00:00-05:00",
    time_zone: "America/New_York",
    venue_name: event.venueName,
  },
  requests: [{ dj_id: page.items[0].id, initial_offer: { currency: "usd", dj_fee_cents: 30000 } }],
  authorization_placement: "gelatin_portal_handoff", // or "partner_event_flow" for Full
  return_url: `https://this-app.example/events/${event.id}`,
});

// 3. Payment: see payments.md.

// 4. Status, by this app's own event ID.
const status = await gelatin.getEventBookings(event.id);
```

Keep `booking.engagements`: each has the `request_id` for payment and alternates, and the `booking_id` for cancelling. Store them with the event.

## Every call

| Call | Scope | What it does |
| --- | --- | --- |
| `gelatin.listDjs(query)` | `catalog:read` | DJs by `city`, `date` (or `set` for a set window), `available`, `genre`, `budget`; pages with `cursor` |
| `gelatin.getDj(djId)` | `catalog:read` | One DJ's public profile: bio, gallery, genres, draw, rate, reviews, listen links, socials, upcoming nights |
| `gelatin.getDjAvailability(djId, { from, to, time_zone })` | `catalog:read` | Each day `available` or `unavailable`, up to 90 days, never saying why |
| `gelatin.listCities()` | `catalog:read` | Cities grouped by state, each with `dj_count` |
| `gelatin.listGenres({ city, budget })` | `catalog:read` | Genres DJs in that city list, busiest first |
| `gelatin.joinCityWaitlist({ email, city, consent: true })` | `requests:write` | Tell an organizer when a city with no DJs gets some |
| `gelatin.submitBookingRequests(request)` | `requests:write` | One booking with a request per DJ. Charges nothing |
| `gelatin.getEventQuote(eventId)` | `bookings:read` | What the organizer is about to authorize, line by line, to show before payment |
| `gelatin.createPortalLaunch(input)` | `launch:write` | A one-use link to Gelatin's co-branded page (Light, and every counteroffer) |
| `gelatin.createPaymentSession(input)` | `launch:write` | Stripe checkout values for one DJ on this app's page (Full) |
| `gelatin.createEventPaymentSession(input)` | `launch:write` | One checkout for every DJ, only when Gelatin has saved cards on for this app |
| `gelatin.getEventBookings(eventId)` | `bookings:read` | Each DJ's status for the event |
| `gelatin.listAlternates(eventId, requestId)` | `bookings:read` | Up to five DJs open that night, after one passes |
| `gelatin.getEventLineup(eventId)` | `bookings:read` | Public-safe lineup: names, photos, profile links, set times. No prices |
| `gelatin.previewCancellation(bookingId)` | `requests:write` | What cancelling would do now, with the rule in plain words |
| `gelatin.cancelBooking(bookingId)` | `requests:write` | Cancels, applying the plan the preview showed |
| `gelatin.getOrganizerStanding(communityRef)` | `bookings:read` | Make a Deal only, and only when Gelatin has it on |

Helpers that need no request: `@gelatinbookings/partner-sdk/places` (states, major cities, `filterCityDirectory`), `@gelatinbookings/partner-sdk/budget` (`BUDGET_BANDS` for checkboxes) and `@gelatinbookings/partner-sdk/genres` (`filterGenres`, `findGenre`). Types are in `@gelatinbookings/partner-sdk/types`.

## Finding DJs

- `city` accepts "Atlanta, GA", "Atlanta" or "Atlanta, Georgia". Use a `label` from `gelatin.listCities()`.
- With a `date`, every DJ carries `available` for that night. Add `available: true` to list only the free ones. Availability is advisory: Gelatin checks again on send and may answer `409 dj_unavailable`.
- An empty page can mean nobody is free or nobody matches. Ask again without `available` to tell the two apart, and offer another date when DJs exist.
- A city with `dj_count: 0`: say Gelatin isn't there yet and offer the waitlist. Don't hide the city.
- When the organizer picks a set time, pass `set: { starts_at, ends_at, time_zone }` instead of `date`, and send the same `set_starts_at` and `set_ends_at` on that DJ's request.

## Status

| `status` | Means | Show |
| --- | --- | --- |
| `authorization_required` | Sent; the card isn't held yet | A "Pay" action |
| `requested` | Card held; the DJ is deciding | Waiting, and that the card is held, not charged |
| `negotiating` | The DJ is answering the organizer's counteroffer | Waiting |
| `reauthorization_required` | The DJ countered | "Review new offer", which opens a portal launch |
| `confirmed` | Booked and paid | Confirmed |
| `declined`, `expired`, `cancelled` | Over, nothing booked | Offer alternates from `gelatin.listAlternates(...)` |

Read status on return, on open, and every few seconds while a DJ is `requested` or `negotiating`, pausing while the tab is hidden. Pass `{ ifNoneMatch: etag }` and skip the render when the result is `{ modified: false }`. In the browser, `startStatusWatcher` from `@gelatinbookings/partner-sdk/browser` does this against this app's own route.

## Cancelling

Show `preview.rule.text` and the preview's amounts, then cancel only if the organizer confirms. Never write the cancellation policy into this app's copy: the preview is the policy, and it changes with how close the event is. A released hold is "released", not "refunded". To change an event's date, cancel and send a new request.

## IDs and retries

- Send this app's `external_event_id` and the organizer's `external_user_id`. Gelatin makes the booking and request IDs.
- The SDK sets idempotency keys and retries network errors, `429` and `503` with the same key. A retry of the same submission is the same booking. To ask the same DJ again on purpose, pass your own `idempotencyKey`.
- `gelatin.createPortalLaunch(...)` makes a one-use link that lasts about 60 seconds. Make it when the organizer clicks, then redirect at once.

## Errors to handle by name

| Status | `code` | Do this |
| --- | --- | --- |
| 400 | `invalid_request` | Fix the input. A `return_url` outside the registered sites lands here too |
| 401 | `unauthorized` | The key is wrong, revoked or from the other environment |
| 403 | `forbidden_scope` | The key lacks the scope for this call |
| 409 | `dj_unavailable` | That DJ can't take the night. Nothing in the submission was saved: remove them and send again |
| 409 | `portal_required` | Pay this DJ through a portal launch |
| 409 | `offer_changed` | Read status before offering payment again |
| 409 | `not_cancellable` | The event has started |
| 429 | `rate_limited` | The SDK already retried; slow down |
