# Testing in the sandbox

A `gel_test_` key works only against Gelatin's sandbox, where every card hold is in Stripe test mode and no real money moves. Build and test the whole journey there before anything else.

## The card

Use Stripe's test card `4242 4242 4242 4242`, any future expiry and any CVC. Never type a real card into the sandbox.

## The journey to check

1. List DJs for a city and night. Check the display rules on every DJ: draw as a range or "Not yet established", tiers as issued, no rate where the rate is null.
2. Send an offer to one DJ. The status reads `authorization_required`.
3. Show the quote, then pay with the test card on Light or Full.
4. While Gelatin records the hold, the screen says "Confirming…". The status becomes `requested`.
5. Send an offer to a second DJ who isn't free, if the sandbox has one, and check `409 dj_unavailable` leaves the rest of the offer intact.
6. Preview a cancellation, show its rule, cancel, and check the status reads `cancelled` and the hold reads "released".
7. Open the event's public page and check it shows no prices and no pending DJ by name.

A DJ's reply comes from the DJ's side of Gelatin. Until a reply arrives, `requested` is the furthest state the app can reach on its own, and the screens for `confirmed`, `declined` and `reauthorization_required` should be checked against the status table in [api.md](api.md).

## Before saying it works

- Run the app's own tests and type check.
- Search the browser bundle and the repository for `gel_test_` and `gel_live_`. Neither may appear outside the env file.
- Read every screen that shows a DJ against [display.md](display.md).
