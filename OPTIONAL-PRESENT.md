# Optional: `[PRESENT]` integration

**You do not need this.** Cast Display tracks presence per chat on its own —
tap any tile in the cast bar to mark a character present or away. This file is
for cards that want to drive the bar automatically instead.

## What it buys you

Without `[PRESENT]`, presence is whatever you last tapped. With it, the card
updates the roster itself as people enter and leave, and you only tap when it
gets something wrong.

A tap always beats a marker in the same message, and a marker in a *later*
message takes over again. Whichever signal is most recent wins, so adding this
never takes control away from you.

## Instruction block

Add this wherever your card already defines its output format.

```
End every reply with:

[PRESENT] Name | Name

List ONLY the characters physically in the current scene, separated by a pipe.
Update it the moment someone enters or leaves. A character who is mentioned,
phoned, or thought about is NOT present. If someone is alone, list that one
name.
```

## Worked example

Everyone in the room:

```
[PRESENT] Nicole | Ivy | Alice
```

Alice goes to her room — only this line changes:

```
[PRESENT] Nicole | Ivy
```

Alice now fades in the cast bar, keeping any state badge she has. If your card
also emits `[TRACK]`, that line is untouched: relationship stages do not move
because somebody walked out.

## Boundary

`[PRESENT]` is assistant output only, like any other marker. Cast Display reads
it from assistant messages after they exist and never writes it into a prompt
or a user message.

## If you'd rather not touch the card

Turn on **Read enter / leave from prose** in the extension settings. It reads
explicit phrasing only — `Alice left.`, `Alice went upstairs.`, `Alice came
back downstairs.` — and abstains on anything ambiguous. It is off by default
because it infers rather than reads.
