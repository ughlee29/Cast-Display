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

### Prose detection

Optional, off by default, deliberately narrow. It fires only on explicit
phrasing in an assistant message - `Alice left.`, `Alice went upstairs.`,
`Alice excused herself.`, `Alice came back downstairs.` - and abstains on
anything else. `Alice left her phone on the table.` is not a departure, and
neither is `Alice looked left down the hall.`

It never guesses from who spoke. Someone can sit silently in a room for twenty
messages and stay present.

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
| Read enter / leave from prose | Optional third presence signal, off by default |
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

It promotes only when every quote in the paragraph resolved, all to the same
name, and at least one by something stronger than carry-over. Two speakers,
pronoun ambiguity, or a single unresolved quote leaves it as ordinary prose
with quote coloring. A missing portrait is a much smaller problem than a wrong
one.

## Notes

Portraits are downscaled to 256px webp and stored in extension settings, so
they travel with your ST settings rather than depending on file paths.

Names may be one to three words, in any script: `Nicole`, `Mrs. Chen`,
`Kaito Ishida`, `Renée`, `The Warden`, `雪`. Rendering matches the literal
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
