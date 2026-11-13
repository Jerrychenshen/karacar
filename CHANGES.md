# Modified KaraCar corresponding source — 2026-11-13

Based on https://github.com/haihan19955/karacar commit
9178b37e57fdf711e6f3b7e79c727f794d8b9ebc. License: AGPL-3.0-only;
original LICENSE and notices retained.

Changes: recognize song brackets including 〈〉 and square brackets; keep full
English song/artist metadata first, with at most four accompaniment queries.
Only verified bilingual title/artist pairs 李佳薇 / 甲乙丙丁 Strangers and
周杰倫 / 晴天 Sunny Day permit a Chinese subtitle fallback. Other mixed names
are not shortened. Require matching title and artist, accompaniment marker,
known positive duration within 20 seconds; reject alternate language/version,
cover, live, remix, duet, numbered-score arrangements, altered key and instrument-only arrangements. No media is
downloaded; metadata cannot prove the audio is authentic, vocal-free or playable.

Use a five-minute server accompaniment cache. Frontend accompaniment lookups
use a runtime WeakMap, ignore old serialized alt/_altP fields, expire after five
minutes and retry transport errors. Tests cover matching, bounded query/ranking,
false positives and frontend cache recovery. Run `npm test` (Node >=18).

The app offers this exact modified source archive at /source-code.tar.gz,
linked on the main page and in its Link response header. The infrastructure's
legacy exact /source redirect still identifies the upstream base commit; it is
outside this change's /opt/karacar write scope. Use /source-code.tar.gz for the
corresponding deployed modified source.

No changes to proxy, credentials, DNS, firewall or other services. Archive
contains app source, license, tests and this note; excludes .git, data and itself.
Recreate with `sh make-source.sh`. No compilation or dependency install needed.


Music-only volume (2026-11-13): accessible 0–100% touch slider in player
controls, English/Simplified/Traditional Chinese labels, local-only preference
with storage-error fallback. Apply through documented YouTube setVolume API
before and after song/track loads, on ready and state changes. Preserve a
sensible existing player volume when no preference exists. Zero sets gain to
zero; an explicit positive slider gesture can unmute, passive rendering cannot.
A bounded delayed getVolume/isMuted readback distinguishes pending, muted,
reported and unconfirmed settings; reported values do not verify audible gain.
Some browsers (including iOS) require device controls. This does not control
microphone gain or vehicle system volume. First-frame audio behavior, Tesla
microphone balance and real vehicle acceptance require physical-device testing.
No dependencies, server/room/library/matching changes or upstream sync.
