# Le Drift — persistance Supabase (Auth + Postgres)

Not wired yet. This page is what it takes to swap the JSON files for Supabase without touching game code.
The server already talks to storage through one port; Supabase is one more adapter behind it.

## 1. Where it plugs in

| Piece | File | Today | With Supabase |
|---|---|---|---|
| Storage port | `server/src/persist/port.ts` (`PersistencePort`) | `jsonPersistence(dir)` in `persist/json.ts` | `supabasePersistence(url, key)` in `persist/supabase.ts` |
| Adapter choice | `server/src/persist/index.ts` + `CONFIG.store` (`DRIFT_STORE`) | `json` | `supabase` |
| Cache | `server/src/persist/store.ts` (`openStore`) | unchanged | unchanged |
| Identity | `server/src/identity.ts` (`authenticate`) | uuid + secret, sha-256 stored in `players.secret_hash` | Supabase access token verified on the server, player id = `sub` |
| Client identity | `src/net/identity.ts` (`loadIdentity`) | uuid + secret in localStorage | `supabase.auth.signInAnonymously()`, session kept by supabase-js |

The rooms never await storage outside `onAuth`: `openStore` loads the world at boot, `authenticate` awaits
`store.loadPlayer(id)`, everything after reads the cache. `flush()` (every `FLUSH_MS`, 10 s, and at shutdown)
sends only the players that changed (`savePlayers`) and the world when its JSON changed (`saveWorld`); a failed
write keeps those players dirty for the next flush. An adapter only has to implement the five port methods.

## 2. Tables

```sql
create table public.players (
  id          uuid primary key references auth.users (id) on delete cascade,
  profile     jsonb not null,                -- { name, color }
  save        jsonb,                         -- PlayerSave, null until the first save
  created_at  timestamptz not null default now(),
  seen_at     timestamptz not null default now(),
  constraint save_size check (save is null or pg_column_size(save) <= 64000)
);

create table public.world (
  id          smallint primary key default 1 check (id = 1),  -- one row: the one Drift
  record      jsonb not null,                -- WorldRecord: epochMs, windows, npcs, tokens
  updated_at  timestamptz not null default now()
);
```

`players.id` is the Supabase user id, so `PlayerRecord.secretHash` is not stored (the adapter returns `''`).
`WorldRecord` stays one jsonb row: it is written by one server every 10 s at most, read once at boot, and
windows/NPC memories are only ever read as a whole. Split it into `windows` / `npc_memories` tables only if
several server processes ever share one Drift.

Adapter mapping (`persist/supabase.ts`, with `@supabase/supabase-js` pinned to an exact version):

| Port method | Query |
|---|---|
| `loadWorld()` | `select record from world where id = 1` → `record` or `null` |
| `loadPlayer(id)` | `select * from players where id = $1` → `PlayerRecord` (epoch ms ↔ timestamptz) |
| `savePlayers(recs)` | one `upsert` of all rows, `onConflict: 'id'` |
| `saveWorld(w)` | `upsert { id: 1, record: w, updated_at: now() }` |
| `close()` | nothing (HTTP client) |

## 3. Row-level security

The game server is the only writer, with the **service role** key (it bypasses RLS). Browsers never write
these tables: progress goes through the Colyseus server, which validates every save (`validate.ts`).

```sql
alter table public.players enable row level security;
alter table public.world   enable row level security;

-- A signed-in player may read their own row (e.g. a future « mes sauvegardes » page). Nothing else.
create policy "player reads own row" on public.players
  for select to authenticated using ((select auth.uid()) = id);

-- No insert/update/delete policy for anon or authenticated: denied by default.
-- No policy at all on world: only the service role reads or writes it.
```

## 4. Auth flow (anonymous sign-in)

1. Client, before joining (`src/net/index.ts` `connect`): `supabase.auth.getSession()`; without a session,
   `supabase.auth.signInAnonymously()`. supabase-js keeps and refreshes the session in localStorage.
2. Join options carry the access token instead of the secret. Protocol change (bump `PROTOCOL_VERSION` to 2):
   `identity: { token: string }`, validated in `validate.ts` as a JWT-shaped string of bounded length.
3. Server `authenticate`: verify the token's signature and expiry against the project's JWKS
   (`https://<project>.supabase.co/auth/v1/.well-known/jwks.json`, asymmetric signing keys), or call
   `supabase.auth.getClaims(token)`. Player id = `sub`. Then `store.loadPlayer(sub)`; a missing row is a new
   player (`save: null`, which already starts them at zero on the client).
4. Reconnection inside `NET.reconnectSeconds` uses the Colyseus reconnection token, not Supabase; a later
   join re-sends a fresh access token.
5. Keeping progress across devices later: `supabase.auth.updateUser({ email })` or `linkIdentity` turns the
   anonymous user into a permanent one with the same id, so `players.id` and the save do not move.

The solo game never touches Supabase: no server answer, no sign-in.

## 5. Environment

| Variable | Where | Value |
|---|---|---|
| `DRIFT_STORE` | server | `supabase` (default `json`) |
| `SUPABASE_URL` | server | `https://<project>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | server only, secret | never in the repo, never sent to a client |
| `VITE_SUPABASE_URL` | client build | same URL |
| `VITE_SUPABASE_ANON_KEY` | client build | the publishable/anon key (public by design, RLS protects the data) |

## 6. What the owner must create

1. A Supabase project (EU region for EU players).
2. Authentication → Sign In / Providers → enable **Anonymous sign-ins**; turn on CAPTCHA (Turnstile) for
   them, since anyone can mint users.
3. Authentication → JWT keys: use asymmetric signing keys (lets the server verify tokens offline via JWKS).
4. Run the SQL of §2 and §3 in the SQL editor (or as a migration).
5. Give the server `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, and the client build `VITE_SUPABASE_URL`
   and `VITE_SUPABASE_ANON_KEY`.
6. Optional: a scheduled job that deletes anonymous users unseen for N months (`players.seen_at`), which
   cascades to their row.

Moving existing JSON players: they have no Supabase user, so they start fresh, or a one-off script creates
an anonymous user per JSON id with `auth.admin.createUser` and copies the save.
