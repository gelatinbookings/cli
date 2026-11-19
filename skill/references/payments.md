# Taking payment

Gelatin always takes the payment. The organizer places a card hold for each DJ, and Gelatin charges it only when that DJ accepts. This app chooses where the organizer types their card, with `authorization_placement` on the submission.

| | Light | Full |
| --- | --- | --- |
| Submit with | `"gelatin_portal_handoff"` | `"partner_event_flow"` |
| Payment call | `gelatin.createPortalLaunch(...)`, then redirect | `gelatin.createPaymentSession(...)` on the server, Stripe's checkout in the browser |
| The organizer | Leaves for Gelatin's co-branded page, then returns to `return_url` | Stays on this app's page |
| Counteroffers | Gelatin's page | Still Gelatin's page, through a portal launch |
| Pick it when | The user wants the quickest integration | The user wants the organizer to stay in the app |

Default to Light. Build Full only when the user asks for it.

## Show the quote first

Before either payment step, read `gelatin.getEventQuote(eventId)` and show every line exactly as Gelatin returns it, then the total. Don't add, drop or rename a line. Show `quote.terms_url` and an "I agree" tick on a Full integration before mounting the checkout. Gelatin's own page does this itself on Light.

## Light

```ts
// A server route the organizer's "Pay" click calls.
const launch = await gelatin.createPortalLaunch({
  external_event_id: event.id,
  external_user_id: user.id,
  resource: { kind: "request", id: requestId },
  return_url: `https://this-app.example/events/${event.id}`,
});
return redirect(launch.launch_url);
```

- Make the link on click, never ahead of time. It is one-use and lasts about 60 seconds.
- From one DJ's page, "All DJs for this event" reaches the rest, so one visit can cover every DJ.
- The `return_url` origin must be registered with Gelatin for this app.
- When the organizer is back, read status.

## Full

Server:

```ts
const session = await gelatin.createPaymentSession({
  external_event_id: event.id,
  external_user_id: user.id,
  resource: { kind: "request", id: requestId },
});
// Send only session.client_secret and session.publishable_key to this organizer's browser.
```

Browser, with `@stripe/stripe-js`:

```ts
import { loadStripe } from "@stripe/stripe-js";

const stripe = await loadStripe(publishableKey);
const checkout = await stripe!.createEmbeddedCheckoutPage({
  fetchClientSecret: async () => clientSecret,
  onComplete: () => showConfirming(),
});
checkout.mount("#gelatin-checkout");
```

- `onComplete` doesn't place the hold. Show "Confirming…" and read status until the DJ leaves `authorization_required`.
- One checkout per DJ. Stripe allows one embedded checkout on a page at a time, so call `checkout.destroy()` before mounting the next.
- Never log `client_secret`. Never compute the total: use `session.total_cents`.
- `409 portal_required` means the DJ countered or their hold began on Gelatin's page. Make a portal launch for that request and redirect.
- If the app sets a Content Security Policy, allow Stripe's documented sources.

## One checkout for every DJ

Only when Gelatin has turned saved cards on for this app. Send the submission with `payment: "event_checkout"`, or call `gelatin.createEventPaymentSession({ external_event_id, external_user_id })` later, and mount the result like any checkout. It saves the card and Gelatin places one hold per DJ in the background. Any DJ still `authorization_required` afterwards needs a portal launch. If Gelatin answers `409 event_checkout_unavailable`, pay per DJ instead. Don't build this unless the user says saved cards are on.
