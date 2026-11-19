# Going live

Real bookings need a live key, and a live key comes only from a review with Gelatin. This skill never asks for, writes or prints one.

## What Gelatin checks

- The whole journey works in the sandbox: list, offer, quote, hold, status and cancel.
- The key is only on the server, and the env file is not in the repository.
- Every screen that shows a DJ follows [display.md](display.md).
- The production `return_url` origins are the ones to register.
- Errors are handled by name, and the app logs `requestId`, not response bodies.

## What the user does

1. Asks Gelatin for a live key once the sandbox journey works.
2. Puts the live key and the live base URL in the production environment's settings, never in the repository and never in chat.
3. Books one real night end to end before telling their users.

## What changes in code

Nothing but the two environment values. If going live needs a code change, something in the sandbox build was wrong.
