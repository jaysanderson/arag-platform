# Walkthrough — the operator console

`/admin/`, protected by `ADMIN_TOKEN`. It is the same product as the workspace — the same shell,
the same components — with its own navigation, because the person running a deployment has
different questions from the person using it.

## Signing in

The sign-in card asks for the `ADMIN_TOKEN` configured for this deployment. It is exchanged for an
HttpOnly cookie; the token is never stored in the page and never reaches any other origin. Getting
it wrong shows the reason in place, without moving the button under your cursor.

If `ADMIN_TOKEN` is unset, every admin route answers 403 with an explanatory detail rather than
silently allowing access.

## Overview

- **Usage strip** — requests served since boot, ARAG calls and how many failed, the average ARAG
  round trip, and process uptime.
- **Health** — the service version, uptime, and the Knowledge Box connection: its id, the endpoint,
  whether it is the mock, the generative model in use, and how many resources it holds. This is the
  first place to look when answers stop being grounded.
- **Usage detail** — the raw `GET /api/v1/admin/usage` payload, including job counts by state.

## Configuration

The effective configuration, merged from `.env` and the environment, with **every secret redacted
to a length bucket** — enough to tell "the key is set and looks right" from "the key is empty",
without putting the value on a screen someone may be sharing.

## Jobs

Every asynchronous unit of work: kind, state, the stage it reached, and when it started. Sort any
column; select a row to see its stage timeline and the full record beside it. A failed job carries
its error message on the timeline, so you can tell a Knowledge Box timeout from a validation error
without reading logs.

## Logs

The in-process ring buffer — the last 500 structured records — newest first, filtered by level and
by substring. Every line carries the `requestId` that the matching RFC 9457 problem response
returned to the client, so a user's "it failed at about 10:15" becomes one search.

Logs are in memory only: they are for triage during an incident, not retention. Ship stdout to your
platform's log service for anything longer-lived.

## What the operator cannot do here

Delete customer data, read a secret, or change configuration. Those are deployment actions
(`fly secrets set`, a redeploy) on purpose — the console is for seeing, not for silent mutation.
The one destructive action in the product, *Delete all notes*, lives in the workspace's Settings
behind a typed confirmation.
