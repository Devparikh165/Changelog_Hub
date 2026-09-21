# Postman

`changelog-hub.postman_collection.json` — import it, or run it headless:

```bash
newman run changelog-hub.postman_collection.json --working-dir .
```

Run the folders in order (the Collection Runner does this for you). Each request stores what the next one needs, so
there is nothing to paste by hand: verification and reset tokens are pulled from the simulated dev mailbox, and the
created entry's id and slug are reused by the public-timeline requests.

- The API must be running with `EMAIL_SIMULATION=true` (the default).
- Auth uses httpOnly cookies. Postman's cookie jar handles them; keep it enabled.
- `sample-cover.png` is there for the *Upload image* request.
- Change `baseUrl` in the collection variables to point at a deployed instance.
