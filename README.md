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
3. Action beat - `Nicole smiled and leaned in. "..."`
4. Continuation - a following quote with no new name between them

A name must occupy **subject position** for the verb, not merely sit near it.
`"Fine," she said to Nicole.` leaves the quote uncolored, because Nicole is
being spoken to. `She looked at Alice. "Two."` likewise stays uncolored rather
than crediting Alice. `"Careful," Ivy whispered to Alice.` does resolve, to Ivy.

If two names survive the subject test, or none do, the quote is left uncolored. An
uncolored quote is a much smaller problem than one in the wrong color, so the
tiers are deliberately conservative. Turn the whole pass off with **Color
unmarked quotes**.

## The cast bar

`[TRACK]` and `[PRESENT]` merge into a single bar at the bottom of the message.

`[TRACK] Nicole:S6 | Ivy:S1` carries state values only. The S number is whatever
your card defines it as, so it renders as a corner badge and **never** marks
anyone absent - a state number says nothing about who is in the room.

`[PRESENT] Nicole | Ivy` is the only source of presence. Listed names are in the
scene; the rest of the cast is faded, hidden, or shown normally per the
**Absent characters** setting. With no `[PRESENT]` line, nobody is marked absent.
Presence is never inferred from who happened to speak - someone can sit silently
in a room for twenty messages.

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
| Reset this card | Clears all cast entries for the current card |

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

Names must be a single word starting with a capital. `Kaito` works,
`Mrs. Chen` does not — add those manually if you need them and the label in
the text matches exactly.
