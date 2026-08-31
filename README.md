# Cast Display

Per-character portraits, dialogue colors, and a present-characters bar for
SillyTavern cards that hold more than one character.

Render-only. It never joins a generation pass, so it cannot touch impersonate,
continue, or anything you type.

## Install

Extensions → Install extension → paste this folder's git URL.

Or drop the folder into:

```
data/<user>/extensions/third-party/cast-display/
```

then reload.

## Use

1. Open the chat.
2. Extensions → Cast Display.
3. **Scan card** reads the description, personality, scenario, first message,
   alternate greetings, and example dialogue. **Scan chat** reads message
   history. **Add manually** for anything both miss.
4. Click a portrait slot to upload an image. Click the swatch to set the
   dialogue color.

Cast tables are keyed to the character card, so a `Sarah` in one card and a
`Sarah` in another keep separate portraits and colors.

## What it renders

| In the message | Becomes |
|---|---|
| `Nicole:` on its own line, dialogue below | portrait block |
| `Nicole: "..."` on one line | portrait block |
| `[TRACK] Nicole:S6 \| Ivy:S1` | cast bar, S rendered as a state badge |
| `[PRESENT] Nicole \| Ivy` | present-characters bar, unlisted cast greyed |
| `[STATE] ...` | dimmed footer, hidden, or plain |
| `Nicole said, "..."` | quote colored in Nicole's color |

A character only renders as a speaker if they are in the cast list. That is
what keeps `Note:` or `Warning:` from turning into portrait blocks.

## Quote attribution

Unmarked dialogue gets colored by a local pass over the rendered text. No
model call, no prompt injection. It reads four patterns, most to least
reliable, and **abstains rather than guessing**:

1. Trailing tag - `"..." Nicole replied.` / `"..." said Nicole.`
2. Leading tag - `Nicole said, "..."`
3. Action beat - `Nicole smiled and leaned in. "..."`, including light-verb
   forms like `Alice let out a snort.` and `Ivy gave a small shrug.`
4. Continuation - a following quote with no new name between them

A name must occupy **subject position** for the verb, not merely sit near it.
`"Fine," she said to Nicole.` leaves the quote uncolored, because Nicole is
being spoken to. `She looked at Alice. "Two."` likewise stays uncolored rather
than crediting Alice. `"Careful," Ivy whispered to Alice.` does resolve, to Ivy.

If two names survive the subject test, or none do, the quote is left uncolored. An
uncolored quote is a much smaller problem than one in the wrong color, so the
tiers are deliberately conservative. Turn the whole pass off with **Color
unmarked quotes**.

## Presence

Presence is **per chat**, not per card - the same card in two chats can have
different people in the room. Everyone discovered starts present.

Three signals feed it, resolved as a fold over the chat from oldest to newest.
Each signal replaces the roster, so **the most recent one wins, whoever
produced it**:

| Signal | Behavior |
|---|---|
| `[PRESENT] Nicole \| Ivy` | Sets the roster absolutely, from that message onward |
| Tapping a tile | Sets it at the message you tapped, beating a marker on that same message |
| Prose detection | Off by default. Explicit phrasing only |

So a card that emits `[PRESENT]` drives the bar automatically; you can still
correct it by tapping; and a later marker takes over again. A card that emits
nothing works purely on taps. No card edits are required for any of this.

**Tap any tile** in the cast bar to toggle that character present or away. With
**Absent characters** on Fade, they immediately go transparent and grayscale
while keeping their state badge. Tap again when they come back.

### Prose detection — Enter and leave

Reads explicit phrasing in an assistant message: `Alice left.`, `Alice went
upstairs.`, `Alice excused herself.`, `Alice came back downstairs.` It abstains
on anything else — `Alice left her phone on the table.` is not a departure.

It also reads scene separations, which need two independent things in the same
message: a separation cue written from the movers' side (`out of the girls'
line of sight`, `away from the others`, `just the two of them`), and a cast
member who is the subject of a movement verb within three sentences of it. The
cue must refer back to the movers and must not name somebody else as the one
being separated.

| Prose | Result |
|---|---|
| `Once they were out of the girls' sight, Nicole followed him into the kitchen.` | Ivy and Alice away |
| `Nicole watched Alice storm out of the room.` | abstains — no separation cue |
| `Nicole rose. Across the hall, Loren and Sam were out of sight.` | abstains — cue names other people |
| `Nicole rose. A moment later, the kids were out of sight.` | abstains — cue does not refer to the mover |
| `Nicole laughed. "We should leave the kids and run away."` | abstains — dialogue, not narration |

### Locations

The stronger mode. Instead of asking "is this character absent", it tracks
**where each character is** and **where the scene is**, and fades anyone whose
location differs. Presence stops being asserted and becomes derived.

**No vocabulary of place names exists anywhere in the code.** Locations are
discovered from the prose, so a bridge, an engine room, a forest clearing, a
watchtower or a dream realm all work exactly like a kitchen. Nothing is
domestic by default.

Everyone starts in one anonymous bucket together with the camera and stays put
until prose moves them. That persistence is the only inference the model makes,
and it is a positive, defeasible one rather than a claim about people the
sentence never names.

That opening bucket stays **unnamed**. `Nicole smiled at the painting.` is not
evidence that the scene is called "painting". Only actual movement establishes
a place.

**Reading a place.** Two things are required. The preposition must sit in a
clause that a movement verb governs, and the phrase must carry a definite
article or be a proper name.

The movement requirement is what separates travel from looking:

| Prose | Result |
|---|---|
| `Nicole walked into the kitchen.` | a journey |
| `Nicole pointed to the kitchen and asked Loren if dinner was ready.` | nothing — pointing is not travel |
| `Nicole glanced toward the kitchen.` | nothing |

The article requirement excludes `into his arms`, `to her phone` and `their
direction`. Bare directions (`upstairs`, `outside`, `below deck`) count too, but
under the same movement rule — `You went upstairs` is travel, `You hear Alice
upstairs` and `They looked downstairs` are not. A short list of body parts and
abstractions is excluded outright. A phrase stops
at the first function word, trailing adverb, or punctuation, so `into the engine
room, leaving the argument behind` yields the engine room and nothing else.

**Proper-name places.** After a bound movement verb, a capitalised one-to-three
word run is accepted with no article, so `headed to Khar Veldun`, `travelled to
Rivendell` and `went to Deck Seven` all work. Cast names and the user persona
are excluded, so `walked over to Alice` is not a destination.

**One place, many spellings.** Phrases merge when one is a word-suffix of the
other, so `the warm kitchen` and `the kitchen` are one bucket while `engine
room` and `living room` stay separate.

**The camera.** The scene follows a movement when the user persona moves, when
an accompaniment verb appears (`followed him`, `went with her`), or when the
subject is first person, second person, or plural. Otherwise the character moves
and the scene stays — which is what distinguishes `Nicole came with me to the
kitchen` from `Alice went upstairs`.

**Movement is clause-scoped.** A destination belongs to the clause that names
it, and a mover only reaches the destination in their own clause. Two people
going to two places in one sentence are two separate events:

| Prose | Result |
|---|---|
| `Alice went upstairs while Nicole went to the kitchen.` | Alice upstairs, Nicole kitchen |
| `Alice headed to the bedroom; Nicole walked into the kitchen.` | Alice bedroom, Nicole kitchen |
| `Nicole and Alice went to the kitchen.` | both move |
| `Nicole, Ivy, and Alice went to the kitchen.` | all three move |
| `Nicole went to the kitchen with Alice.` | both move |
| `Alice went upstairs while you stayed in the living room.` | Alice moves, camera stays |
| `Alice walked into the kitchen with you.` | both move |

When the camera moves, whoever is acting in that same clause travels with it.
The clause that moves the camera often names nobody — the actors sit in a
neighbouring clause. Reaching into that clause needs real evidence, not just a
friendly connector: either the camera subject was a third-person plural that can
refer back to them, or their own clause shows movement or accompaniment.

| Prose | Result |
|---|---|
| `Once they reached the kitchen, Nicole leaned against the counter.` | Nicole comes along — `they` refers back |
| `We went to the kitchen and Alice followed.` | Alice comes along — she followed |
| `We went to the kitchen and Alice watched TV.` | Alice stays put |
| `We went to the kitchen, Alice watched TV.` | Alice stays put |
| `We went to the kitchen while Alice stayed behind.` | Alice stays put |

Arriving with no destination named puts a character where the scene is:
`Nicole returned.`, `Alice walked in.`, `Alice reappeared.`, `Alice joined
them.` The verb has to be intransitive, so `Nicole returned the book.`,
`Nicole returned his call.` and `Alice appeared nervous.` move nobody.

An empty scene is a legitimate state — `You walked into the kitchen alone.`
leaves the whole cast behind and the bar correctly shows nobody present. There
is one fallback for the case where the camera moved without the prose saying
so: if the scene empties and *no* camera signal appeared in the message, the
camera is assumed to have followed the majority. It never fires when the prose
already said where the camera went, when someone went somewhere alone, or when
the cast splits evenly.

When a character's location differs from the scene, the cast tile shows where
they actually are, so a mis-parse is visible rather than silent.

### Restore on speech

Presence is never inferred from who spoke — but a character marked absent who
is then given dialogue is usually present, so their absence is cleared. This
runs in the safe direction only: it can un-fade someone, never fade them.

In Locations mode the restore **moves the character to the scene** rather than
editing the derived set, so it persists. Patching the derivation alone would
leave the stored location stale and fade them again on the next message.

Speech does not always mean presence, though. A character can shout from
upstairs, call on the phone, or be heard through a door without entering the
scene, so remote dialogue is vetoed and the roster is left unchanged:

| Prose | Restores? |
|---|---|
| `Alice walked in. "Found you."` | yes |
| `Alice called from upstairs. "Mom?"` | no |
| `Alice: "Can you hear me?"` + `The phone crackled.` | no |
| `Alice's voice drifted from the hallway.` | no |

The veto is deliberately broad — `phone`, `intercom`, `muffled`, `in the
distance`, `from the hallway` and similar all block a restore. A missed
restore just means you tap the tile.

## The cast bar

`[TRACK] Nicole:S6 | Ivy:S1` carries state values only. The S number is whatever
your card defines it as, so it renders as a corner badge and **never** marks
anyone absent - a state number says nothing about who is in the room.

**Show cast bar on** controls where it appears: marker messages, the latest
message, or both. Markerless cards should use one of the latter two so the bar
still shows up.

**Cast bar size** switches between full tiles and a compact row for narrow
screens. Badges survive both.

## Settings

| Setting | Does |
|---|---|
| Color unmarked quotes | Runs the attribution pass |
| Promote attributed prose | Turns confidently-attributed paragraphs into portrait blocks |
| Show attribution debug | Labels each quote with the tier that decided it |
| Cast bar size | Full or Compact |
| Absent characters | Fade / Hide / Show |
| Show state badge | The `S` value from `[TRACK]` |
| Show cast bar on | Marker messages, latest message, or both |
| Track presence from prose | Off / Enter and leave / Locations. Off by default |
| Reset this card | Clears cast entries and presence for the current card and chat |

## Color ownership

Inside any portrait block, quoted dialogue takes the character's color and
action text stays neutral. So a block containing
`"Cut him some slack." She beamed at him. "Want tea?"` renders both quotes in
one color with the action beat in normal text, rather than a mixture.

## Portrait promotion

With **Promote attributed prose** on, a paragraph like
`Nicole smiled. "You work too hard."` becomes a Nicole portrait block even
though the model never wrote a `Nicole:` marker.

A blank line ends a paragraph, so each paragraph is attributed and promoted on
its own. Attribution windows also stop at a line break, so a tag in the next
paragraph can never be read as belonging to this one.

### Anchor carry

A character established in one paragraph carries into immediately following
pronoun-only paragraphs, so this resolves to Nicole throughout:

```
Nicole let out a soft, surprised gasp as she was pressed back against the wall.

She melted into the contact, her body relaxing as she hummed into the kiss.

"Well," she murmured. "That certainly beats what I was thinking."
```

The possessive subject counts too — `Nicole's brows lifted` establishes her as
readily as `Nicole lifted her brows`.

The anchor clears whenever there is any competing candidate: another cast name
appearing anywhere in the run, two names in one paragraph, a bridging paragraph
with no pronoun in it, or more than three paragraphs of drift. It never chooses
between two characters — it only extends a run where exactly one is in play.

It promotes only when every quote in the paragraph resolved, all to the same
name, and at least one by something stronger than carry-over. Two speakers,
pronoun ambiguity, or a single unresolved quote leaves it as ordinary prose
with quote coloring. A missing portrait is a much smaller problem than a wrong
one.

## Notes

Portraits are downscaled to 256px webp and stored in extension settings, so
they travel with your ST settings rather than depending on file paths.

Names may be one to three words, in any script: `Nicole`, `Mrs. Chen`,
`Kaito Ishida`, `Renée`, `The Warden`, `雪`. A period inside a name is never
treated as a sentence or clause boundary, so `Mrs. Chen and Alice went to the
kitchen` moves both of them. Rendering matches the literal
names in your cast list, so whatever shape a name has, once it is in the cast
it renders. Overlapping names are handled — a cast holding both `Chen` and
`Mrs. Chen` will not confuse one for the other.

## Cast discovery

**Scan card** and **Scan chat** read four independent shapes, so a card that
never writes `Name:` anywhere still produces a cast list:

- `Name:` **followed by dialogue** — `Nicole:` with `"..."` on the next line
- `Name:S6` state tokens
- Subjects of speech verbs — `Marta asked`, `muttered Grix`
- Action beats followed by a quote — `Piet grinned. "Don't mind him."`

Those four are trusted on their own. Note the first one: a colon label only
counts as a speaker when dialogue follows it, because cards are full of field
labels in exactly that shape — `Family Dynamics:`, `Character Goals:`,
`Speech Patterns:`. A colon label followed by prose is demoted to weak. Headings and list items — `## Marta`,
`**Piet**`, `- Grix` — are a **weak** signal, because ordinary cards are full
of `## Personality` and `- Sarcastic`. They are only accepted when they sit
inside a cast-like section (`## Characters`, `**Cast**`, `## Family`) or when
one of the strong signals names the same character elsewhere in the card.

**Add manually** covers anything the scans miss, and **Reset this card** clears
a cast that picked up something it shouldn't have.

## Limits

The attribution and prose-detection vocabularies are English. On a non-English
card, explicit `Name:` labels, manual cast entry, the cast bar, tap-to-toggle
presence, and `[PRESENT]` all work normally — automatic quote attribution and
prose enter/leave detection do not.
