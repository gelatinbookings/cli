# Gelatin CLI

Add Gelatin to your app: book DJs, venues and creatives through Gelatin's partner API. One command puts the Gelatin skill in your project for your coding agent, and gives your app a test key.

Needs Node 20 or later.

## Put the skill in your project

```sh
npx github:gelatinbookings/cli install
```

- Writes the Gelatin skill for Claude Code, Codex and Cursor into the project.
- Installs the partner SDK with the project's own package manager.

`install` needs no account and never reads, asks for or writes a key.

## Get a test key

```sh
npx github:gelatinbookings/cli login
```

Signs you in with your Gelatin account in the browser.

```sh
npx github:gelatinbookings/cli init
```

Creates a test app and writes `GELATIN_API_BASE` and `GELATIN_API_KEY` to the project's env file. Test keys never move real money.

## A whole booking in test mode

1. List DJs: `GET $GELATIN_API_BASE/djs`.
2. Send an offer: `POST $GELATIN_API_BASE/booking-requests`.
3. Open the portal launch and place the card hold with Stripe's test card `4242 4242 4242 4242`.
4. Make the test DJ answer:
   ```sh
   npx github:gelatinbookings/cli test answer <booking_id> accept
   ```
   The answer can also be `pass`, `expire`, or `counter --fee 150 --note "Two-hour set"`.
5. Read the result: `GET $GELATIN_API_BASE/events/<external_event_id>/dj-bookings`. After an accept, the booking reads `confirmed`, usually within a minute.

## Other commands

| Command | What it does |
| -- | -- |
| `whoami` | Shows who is signed in |
| `logout` | Ends the sign-in on this computer |
| `keys` | Lists the test app's keys |
| `sites` | Lists the sites the app may return to |
| `usage` | Shows the app's usage |

## Pin a version

```sh
npx github:gelatinbookings/cli#v0.1.0 install
```

Each release is a tag on this repository.
