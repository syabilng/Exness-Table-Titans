# 🏓 PADDLE ROYALE — Inter-Department Table Tennis Leaderboard

A gritty, broadcast-graphics-style weekly leaderboard for office table tennis.
Static site — no build step, no backend. All data lives in your browser's
`localStorage`.

## Run it

Any static server works:

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

(Or just open `index.html` directly in a browser.)

## Features

- **Weekly leaderboard banners** — rank, photo, This-Week W–L and All-Time W–L
  for every player, sorted by weekly wins. Auto-resets weekly stats when a new
  ISO week starts (all-time records are kept), plus a manual ⟲ reset button.
- **Award-style entrance** — preloader, 3D flip-in banner stagger with rolling
  rank counters, ticker tape of live standings.
- **Cursor interactions** — banners lift and tilt in 3D toward the cursor with
  a glow that follows the mouse (GSAP `quickTo`; disabled on touch devices).
- **Player cards** — tap any banner for a full-screen animated profile
  (diagonal wipe transition, letter-by-letter name reveal, counting stats,
  career win-rate bar).
- **Record results** — "+ RECORD MATCH" picks a winner and loser and updates
  weekly + all-time stats; per-player quick **+ WIN / + LOSS** buttons on the
  profile card.
- **Manage the roster** — "+ ADD PLAYER" (with optional photo), remove players
  from their profile card.
- **Custom photos** — "CHANGE PHOTO" on any player card; images are resized
  client-side and stored in `localStorage`.
- **Background music** — looping BGM with a volume slider and mute toggle
  (bottom-right dock). Starts on first tap/click per browser autoplay rules.

## Music

The background track is `assets/music.mp3` (the uploaded "ES_PRESSURE!" file,
moved into `assets/`). To swap tracks, just replace `assets/music.mp3` — no
code changes needed. If the mp3 is ever missing, the site falls back to a
bundled generated ambient loop (`assets/music-loop.wav`).

## Stack

- Vanilla HTML/CSS/JS
- [GSAP 3](https://gsap.com) (vendored at `js/vendor/gsap.min.js`) for all
  animation
- Canvas 2D ambient background (drifting embers + perspective court lines)
- Fonts vendored locally (Archivo Black, Barlow Condensed)

## Notes

- Data schema is stored under the `paddle-royale-v1` localStorage key; audio
  preferences under `paddle-royale-audio`. Clearing site data reseeds the
  default roster.
- Fully responsive; tilt/hover effects gracefully degrade on touch.
