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

- **Poster hero** — full-screen intro with the club shield, giant display
  type, parallax halftone/star/scribble decorations, and ping pong balls that
  spin with the scroll; the leaderboard section reveals as you scroll to it.
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

- Vanilla HTML/CSS/JS (`js/app.js` is loaded as an ES module)
- [GSAP 3](https://gsap.com) (vendored at `js/vendor/gsap.min.js`) for all
  animation
- [Firebase Firestore](https://firebase.google.com/docs/firestore) (loaded
  from Google's official CDN) for shared, real-time player data
- Canvas 2D ambient background (drifting embers + perspective court lines)
- Fonts vendored locally (Spaceland Eight Oblique for display, Barlow Condensed for labels)

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

## Notes

- Audio volume/mute preferences are personal and stay in each browser's
  `localStorage` under `paddle-royale-audio` — they don't sync between
  people, only the leaderboard data does.
- Fully responsive; tilt/hover effects gracefully degrade on touch.
- If the page can't reach Firestore (offline, rules not published yet), it
  shows an alert rather than silently failing.
