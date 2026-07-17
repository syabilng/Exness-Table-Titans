# 🏓 EXNESS PING PONG ALL-STARZ — Weekly Leaderboard

A retro sports-poster weekly leaderboard for office table tennis (NBA×ESPN
campaign style: grape/cream/brick/teal/magenta palette, halftone bursts,
chunky slab-stacked banners, hard offset type shadows).
Static site — no build step. Player data lives in a shared Firebase Firestore
database, so anyone with the link sees and edits the same live leaderboard in
real time.

## Run it

Any static server works:

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

(Or just open `index.html` directly in a browser.)

## Features

- **Poster hero** — full-screen intro built around the 3D floating club
  crest (layered-depth entrance, perpetual float, pointer tilt), code-drawn
  speed lines that rush toward the center as you scroll, parallax
  decorations, and Three.js ping pong balls with the ex logo printed on the
  sphere, rolling with the scroll; the leaderboard reveals on scroll.
- **Weekly leaderboard banners** — rank, photo, This-Week W–L and All-Time W–L
  for every player, sorted by weekly wins. Auto-resets weekly stats when a new
  ISO week starts (all-time records are kept), plus a manual ⟲ reset button.
  Banners are chunky layered slabs that lift, tilt, and spread on hover.
- **Award-style entrance** — preloader, 3D flip-in banner stagger with rolling
  rank counters, ticker tape of live standings.
- **Cursor interactions** — banners lift and tilt in 3D toward the cursor with
  a glow that follows the mouse (GSAP `quickTo`; disabled on touch devices).
- **Player cards** — tap any banner for a full-screen animated profile
  (diagonal wipe transition, letter-by-letter name reveal, counting stats,
  career win-rate bar).
- **Match referee** (`#/match`) — "RECORD MATCH" opens a live two-sided
  scoreboard: pick a player per side, choose the game mode (to 11 / 15 / 21),
  and score with big +/− buttons. Real service rotation (2 serves each for 11,
  2 or 3 for 15, 5 for 21) with a glow + "SERVING n/m" chip on the server,
  automatic deuce handling (alternate every point, win by 2), and the result
  records to both players' weekly + all-time stats the moment the game ends.
  Per-player quick **+ WIN / + LOSS** buttons remain on the profile card.
- **House rules page** (`#/rules`) — scoring, service, and deuce rules for
  the 11 / 15 / 21-point formats.
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

- Vanilla HTML/CSS/JS (`js/app.js` is loaded as an ES module)
- [Three.js](https://threejs.org) (vendored) for the textured ping pong balls
- [GSAP 3](https://gsap.com) (vendored at `js/vendor/gsap.min.js`) for all
  animation
- [Firebase Firestore](https://firebase.google.com/docs/firestore) (loaded
  from Google's official CDN) for shared, real-time player data
- Canvas 2D ambient background (drifting embers + perspective court lines)
- Fonts vendored locally (Spaceland Eight Oblique for display; Garamond for the board sub-line)

## Shared data (Firestore)

Player records live in a `players` collection (one document per player) plus
a single `leaderboard/meta` document holding the current ISO week. Every
visitor's browser subscribes live via `onSnapshot`, so adding a player,
recording a match, or a quick +WIN/+LOSS shows up for everyone within a
moment — no login required, by design.

The Firebase project config in `js/app.js` (`firebaseConfig`) is not a
secret — Firebase client keys are meant to be public; access is controlled
entirely by the Firestore **security rules**, set once in the Firebase
console under Firestore Database → Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /players/{playerId} { allow read, write: if true; }
    match /leaderboard/{docId} { allow read, write: if true; }
  }
}
```

This intentionally allows anyone with the link to read and write leaderboard
data (no accounts, matching the "just for us to see who's leading" brief).
Firestore's default "test mode" rules expire after 30 days — publish the
rules above to keep the site working indefinitely.

Because writes use Firestore's atomic `increment()` and batched writes,
concurrent edits (two people clicking "+1 win" at once) resolve safely
without one overwriting the other.

## Weekly + full resets

- Weekly W–L auto-resets every **Monday 12:00am Malaysia time** (the week id
  is computed on UTC+8, so the rollover happens for everyone at once).
- A discreet **Reset Data** link in the footer wipes every score (weekly and
  all-time) after a security PIN. Only the SHA-256 hash of the PIN lives in
  the code. Note: this is a courtesy gate, not real security — the site has
  no accounts, so anyone technical could still write to the database.

## Notes

- Audio volume/mute preferences are personal and stay in each browser's
  `localStorage` under `paddle-royale-audio` — they don't sync between
  people, only the leaderboard data does.
- Fully responsive; tilt/hover effects gracefully degrade on touch.
- If the page can't reach Firestore (offline, rules not published yet), it
  shows an alert rather than silently failing.
