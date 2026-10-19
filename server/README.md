# Le Drift server

`npm run server` (from the repo root) starts the Colyseus server on `ws://localhost:8787` (`PORT`), saving to
`server/data/` (`DRIFT_DATA_DIR`). `npm --prefix server run bots` joins three fake players against a running
server (`DRIFT_SERVER`, default `ws://localhost:8787`) and checks presence, chat, seats, windows and movement
guards; exit code 1 on any failure. Design and ownership: `docs/MULTI.md`.
