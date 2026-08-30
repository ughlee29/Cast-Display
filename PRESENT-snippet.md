# Adding [PRESENT] to a card

Cast Display never guesses who is in the room. Presence comes only from a
`[PRESENT]` line, so the card has to emit one.

Add this next to wherever your card already defines `[TRACK]` and `[STATE]`.

## Instruction block

```
End every reply with these three lines, in this order:

[TRACK] Name:S# | Name:S# | Name:S#
[PRESENT] Name | Name
[STATE] Name:P#,N#,A# | Name:P#,N#,A#

[TRACK] lists every known character and their current stage. It does not
indicate location.

[PRESENT] lists ONLY the characters physically in the current scene, separated
by a pipe. Update it the moment someone enters or leaves. A character who is
mentioned, phoned, or thought about is NOT present. If a character is alone,
[PRESENT] contains that one name.
```

## For Loving Family specifically

```
[TRACK] Nicole:S6 | Ivy:S1 | Alice:S1
[PRESENT] Nicole | Ivy | Alice
[STATE] Nicole:P0,N0,A0 | Ivy:P0,N0,A0 | Alice:P0,N0,A0
```

When Alice leaves for her room, the next reply becomes:

```
[TRACK] Nicole:S6 | Ivy:S1 | Alice:S1
[PRESENT] Nicole | Ivy
[STATE] Nicole:P0,N0,A0 | Ivy:P0,N0,A0 | Alice:P0,N0,A0
```

`[TRACK]` is unchanged - stages do not move because someone walked out. Only
`[PRESENT]` changes, and Alice fades in the cast bar with her S1 badge intact.

## Boundary

`[PRESENT]` is assistant output only, exactly like `[TRACK]` and `[STATE]`.
It is never written into user messages, and Cast Display only ever reads it
from assistant messages after they exist.
