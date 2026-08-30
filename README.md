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

## [TRACK] is not presence

The S value in `[TRACK] Nicole:S6` is whatever your card defines it as -
relationship stage, affinity, whatever. It is rendered as a badge and never
greys anyone out, because a state number says nothing about who is in the
room. For real presence, emit a separate `[PRESENT]` line; only that one
greys absent characters.

## Notes

Portraits are downscaled to 256px webp and stored in extension settings, so
they travel with your ST settings rather than depending on file paths.

Names must be a single word starting with a capital. `Kaito` works,
`Mrs. Chen` does not — add those manually if you need them and the label in
the text matches exactly.
