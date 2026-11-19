---
name: gelatin
description: Use when adding Gelatin to this app so its users can find and book DJs: listing DJs by city and night, showing a DJ's profile, sending an offer, taking the card hold, reading booking status, cancelling, or showing a public lineup. Covers the partner SDK, the payment paths and the display rules Gelatin requires.
---

# Gelatin

Gelatin is a talent marketplace. This app shows Gelatin's DJs to its own users and books them through Gelatin's partner API. Gelatin is the seller: it takes the card hold, charges it when the DJ accepts, pays the DJ and handles refunds. This app never touches card numbers, never moves money and never works out a price.

## Before writing code

1. Check the project's env file for `GELATIN_API_BASE` and `GELATIN_API_KEY`. If either is missing, tell the user to run `npx github:gelatinbookings/cli init`, which writes a test key. Never invent a key and never ask the user to paste one into chat.
2. The key must start with `gel_test_`. If it starts with `gel_live_`, stop and tell the user: build and test against the sandbox first.
3. Install the SDK if it isn't there: `npm install github:gelatinbookings/gelatin-partner-sdk#v0.1.0-alpha.10`. It needs Node.js 20 or later.
4. Decide these four things with the user, or from the code when it's obvious:
   - **Where booking happens:** usually the page where an organizer creates or edits an event.
   - **Which IDs to send:** this app's own event ID as `external_event_id` and the organizer's user ID as `external_user_id`.
   - **Light or Full payment:** Light sends the organizer to Gelatin's co-branded page to pay. Full keeps them on this app's page with Stripe's checkout. Default to Light unless the user wants Full. See [references/payments.md](references/payments.md).
   - **What to show:** a DJ list, a DJ's profile, the booking status, a public lineup on the event page.

## Rules that are never broken

- **The key stays on the server.** Create the client in server-only code. Browser code calls this app's own routes, which call Gelatin. Never send the key, or any Gelatin response that contains it, to the browser. Never commit the env file.
- **Never compute money.** Show `total_cents` from a payment session or the figures from `gelatin.getEventQuote(eventId)`. Never add a fee, a percentage or processing to a DJ's rate.
- **A hold isn't real until Gelatin says so.** On both paths, when the organizer comes back from paying (to `return_url` on Light, or when Stripe's checkout completes on Full), show "Confirming…" for each DJ still at `authorization_required` and read status every few seconds until the DJ leaves it. Mark the return in `return_url`, for example `?paid=1`, so the page knows to confirm.
- **Status is pull-only.** Gelatin never calls this app. Read status when the organizer returns, when they open the event, and on a timer while a DJ is deciding.
- **Store what the offer returns.** Save each engagement's `request_id`, `booking_id`, `dj_id` and the DJ's name with the event when `gelatin.submitBookingRequests(...)` answers. The status feed carries `request_id` and `dj_id` only: without the stored `booking_id` the app can't cancel, and without the name it can't say who a request is for. If the app has no database yet, add a table for this before building the offer step.
- **Booking is for the organizer only.** Offers, status, totals, pay and cancel belong on a page only the event's organizer can open, or behind a check that the signed-in user owns the event. A page anyone can open shows the public lineup and nothing else.
- **Build `return_url` from configuration.** Use an app URL from the environment, such as `APP_URL`, never the request's `Host` header. Its origin must be registered with Gelatin.
- **Follow the display rules** in [references/display.md](references/display.md): draw as a range or "Not yet established", never one number or a zero; tiers as issued; a null rate shows no price; nothing about money on a public page; a pending DJ is never named.
- **Make a Deal is off** until Gelatin turns it on for this app. Don't build it unless the user says it's on.
- **Never write, request or print a live key.** Going live is a review with Gelatin. See [references/going-live.md](references/going-live.md).

## Order of work

1. A server module that creates the client once:

   ```ts
   import { createPartnerClient } from "@gelatinbookings/partner-sdk/server";

   export const gelatin = createPartnerClient({
     baseUrl: process.env.GELATIN_API_BASE!,
     apiKey: process.env.GELATIN_API_KEY!,
   });
   ```

   In Next.js with Cache Components on, a Server Component that calls Gelatin reads live data: call `await connection()` from `next/server` before the call, or Next.js stops the prerender.

2. A DJ list for the event's city and night, with `gelatin.listDjs({ city, date, available: true })`.
3. An offer step: the organizer picks DJs and a fee, and the server sends `gelatin.submitBookingRequests(...)`.
4. The payment step, Light or Full.
5. Status on the event page, from `gelatin.getEventBookings(eventId)`.
6. Cancelling, with `gelatin.previewCancellation(bookingId)` shown before `gelatin.cancelBooking(bookingId)`.
7. If the event has a public page, the lineup from `gelatin.getEventLineup(eventId)`.
8. Test the whole journey in the sandbox. See [references/testing.md](references/testing.md).

Every call, its scope and its errors are in [references/api.md](references/api.md).

## When something goes wrong

Every failed call throws `PartnerApiError` with `status`, `code` and `requestId`. Handle the codes in [references/api.md](references/api.md) by name. Show the organizer a plain sentence and log the `requestId`, never the response body.
