import { extension_settings, getContext } from '../../../extensions.js';
import { saveSettingsDebounced, eventSource, event_types, messageFormatting } from '../../../../script.js';

const MODULE = 'castDisplay';

// ---------------------------------------------------------------------------
// settings
// ---------------------------------------------------------------------------

const defaults = {
    enabled: true,
    showTag: true,
    tagText: 'Speaking',
    showBar: true,
    barLabel: 'Cast',
    barSize: 'full',        // 'full' | 'compact'
    showStage: true,        // S-value badge from [TRACK]
    absentMode: 'fade',     // 'fade' | 'hide' | 'show'
    stateLine: 'dim',       // 'dim' | 'hide' | 'plain'
    attribute: true,        // color unmarked quotes
    promote: true,          // turn confidently-attributed prose into portrait blocks
    debug: false,           // show why each quote was attributed
    portraitPx: 256,
    cards: {},              // avatarKey -> { chars: { Name: { color, img } } }
};

const PALETTE = [
    '#f2809f', '#b39ddb', '#7fc8a9', '#f0b357',
    '#8ab4f8', '#e8846b', '#a6d47a', '#d78ce0',
];

function settings() {
    if (!extension_settings[MODULE]) extension_settings[MODULE] = {};
    const s = extension_settings[MODULE];
    for (const [k, v] of Object.entries(defaults)) {
        if (s[k] === undefined) s[k] = structuredClone(v);
    }
    return s;
}

/** Key the cast table to the card, not the name, so two cards can both have a "Sarah". */
function cardKey() {
    const ctx = getContext();
    if (ctx.groupId) return `group:${ctx.groupId}`;
    const ch = ctx.characters?.[ctx.characterId];
    return ch?.avatar ? `card:${ch.avatar}` : null;
}

function cast() {
    const key = cardKey();
    if (!key) return {};
    const s = settings();
    if (!s.cards[key]) s.cards[key] = { chars: {} };
    return s.cards[key].chars;
}

function nextColor() {
    const used = new Set(Object.values(cast()).map(c => c.color));
    return PALETTE.find(c => !used.has(c)) ?? PALETTE[Object.keys(cast()).length % PALETTE.length];
}

function addChar(name) {
    const c = cast();
    if (c[name]) return false;
    c[name] = { color: nextColor(), img: '' };
    return true;
}

function colorOf(name) {
    return cast()[name]?.color ?? '#9aa7b8';
}

// ---------------------------------------------------------------------------
// patterns
// ---------------------------------------------------------------------------

const NAME = "[A-Z][\\w'\u2019-]{1,19}";
const RE_LABEL   = new RegExp(`^(${NAME}):[ \\t]*$`);
const RE_INLINE  = new RegExp(`^(${NAME}):[ \\t]+(["\u201c\u201d].*)$`);
const RE_TRACK   = /^\[TRACK\][ \t]*(.*)$/;
const RE_STATE   = /^\[STATE\][ \t]*(.*)$/;
const RE_PRESENT = /^\[PRESENT\][ \t]*(.*)$/;
const RE_TOKEN   = new RegExp(`(${NAME}):S(\\d+)`, 'g');
const RE_ANY     = new RegExp(`^(${NAME}):`, 'gm');

const NOT_NAMES = new Set([
    'Note', 'Notes', 'Rule', 'Rules', 'Warning', 'Example', 'Examples',
    'Scenario', 'Summary', 'System', 'Setting', 'Location', 'Time',
    'Personality', 'Description', 'Appearance', 'Background', 'Output',
    'Format', 'Instructions', 'You', 'Me', 'I', 'The', 'A', 'An', 'It',
    'Track', 'State', 'Status', 'Present', 'Objective', 'Goal', 'Tip',
]);

function harvest(text, into) {
    if (!text) return;
    let m;
    RE_ANY.lastIndex = 0;
    while ((m = RE_ANY.exec(text)) !== null) {
        if (!NOT_NAMES.has(m[1])) into.add(m[1]);
    }
    RE_TOKEN.lastIndex = 0;
    while ((m = RE_TOKEN.exec(text)) !== null) {
        if (!NOT_NAMES.has(m[1])) into.add(m[1]);
    }
}

/** Names found in the character card itself, before anyone has spoken. */
function scanCard() {
    const ctx = getContext();
    const found = new Set();
    const ch = ctx.characters?.[ctx.characterId];
    if (ch) {
        for (const f of [ch.description, ch.personality, ch.scenario, ch.first_mes, ch.mes_example]) {
            harvest(f, found);
        }
        for (const g of (ch.data?.alternate_greetings ?? [])) harvest(g, found);
    }
    return found;
}

function scanChat() {
    const found = new Set();
    for (const msg of (getContext().chat ?? [])) {
        if (!msg.is_user) harvest(msg.mes, found);
    }
    return found;
}

// ---------------------------------------------------------------------------
// local speaker attribution - render-only, no model call, abstains when unsure
// ---------------------------------------------------------------------------

const SAY_VERBS = ['said', 'says', 'replied', 'replies', 'asked', 'asks', 'added', 'adds',
    'whispered', 'whispers', 'muttered', 'mutters', 'murmured', 'murmurs', 'shouted',
    'shouts', 'called', 'calls', 'answered', 'answers', 'continued', 'continues',
    'offered', 'offers', 'remarked', 'remarks', 'noted', 'notes', 'observed', 'observes',
    'explained', 'explains', 'insisted', 'insists', 'agreed', 'agrees', 'admitted',
    'admits', 'countered', 'counters', 'protested', 'protests', 'warned', 'warns',
    'promised', 'promises', 'teased', 'teases', 'snapped', 'snaps', 'sighed', 'sighs',
    'breathed', 'breathes', 'echoed', 'echoes', 'drawled', 'drawls', 'mused', 'muses'];

const SOFT_VERBS = ['smiled', 'grinned', 'laughed', 'chuckled', 'shrugged', 'nodded',
    'frowned', 'hummed', 'snorted', 'blinked', 'glanced', 'looked', 'turned', 'leaned',
    'paused', 'shook', 'tilted', 'raised', 'lowered', 'crossed', 'beamed', 'winced',
    // common action beats that carry dialogue in practice
    'set', 'put', 'placed', 'reached', 'stood', 'sat', 'rose', 'stepped', 'moved',
    'pulled', 'pushed', 'opened', 'closed', 'wiped', 'folded', 'tucked', 'brushed',
    'tapped', 'waved', 'pointed', 'gestured', 'hesitated', 'exhaled', 'swallowed',
    'straightened', 'settled', 'dropped', 'lifted', 'took', 'walked', 'turned'];

const ALL_VERBS = SAY_VERBS.concat(SOFT_VERBS);
const RE_QUOTE = /["\u201c]([^"\u201c\u201d]{1,800}?)["\u201d]/g;

/** Prepositions that mark the following name as the object, not the speaker. */
const OBJECT_PREPS = new Set(['to', 'at', 'toward', 'towards', 'with', 'for', 'about',
    'from', 'of', 'beside', 'behind', 'near', 'against', 'between', 'among', 'past',
    'across', 'alongside', 'opposite', 'unlike', 'than', 'like', 'upon', 'around',
    'beyond', 'off', 'below', 'above']);

function escRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Distinct cast names appearing as whole words in a fragment. */
function namesIn(text, names) {
    const hits = new Set();
    for (const n of names) {
        if (new RegExp(`\\b${escRe(n)}\\b`).test(text)) hits.add(n);
    }
    return [...hits];
}

/**
 * True only when `name` occupies subject position for one of `verbs` in `frag`.
 * Proximity is not enough: "she said to Nicole" must not make Nicole the
 * speaker, and "She looked at Alice." must not make Alice the next speaker.
 * `mustLead` also requires the name to open the fragment, used for the
 * trailing-tag form where a soft verb is only trustworthy right after a quote.
 */
function subjectOf(frag, name, verbs, mustLead) {
    const vs = verbs.join('|');
    const forward = new RegExp(`^[\\s,]*(?:\\w+\\s+){0,3}?(?:${vs})\\b`, 'i');
    const inverted = new RegExp(`\\b(?:${vs})\\s+$`, 'i');
    const finder = new RegExp(`\\b${escRe(name)}\\b`, 'g');
    let m;
    while ((m = finder.exec(frag)) !== null) {
        const pre = frag.slice(0, m.index);
        if (mustLead && /[A-Za-z]/.test(pre)) continue;
        const prev = (pre.match(/([A-Za-z']+)[^A-Za-z']*$/) || [])[1];
        if (prev && OBJECT_PREPS.has(prev.toLowerCase())) continue;
        const post = frag.slice(m.index + name.length, m.index + name.length + 48);
        if (forward.test(post) || inverted.test(pre)) return true;
    }
    return false;
}

/** Names in `frag` that pass the subject test. Exactly one, or nobody. */
function pick(frag, names, verbs, mustLead) {
    const found = namesIn(frag, names).filter(n => subjectOf(frag, n, verbs, mustLead));
    return found.length === 1 ? found[0] : null;
}

/**
 * A tag sitting immediately before the quote, as in `Nicole said, "..."`.
 * Prose convention binds an adjacent tag to its own quote, so this outranks a
 * trailing tag - otherwise `Nicole said, "Hi." Alice replied, "Bye."` reads
 * Alice's tag as belonging to Nicole's line.
 */
function pickTight(frag, names) {
    const vs = SAY_VERBS.join('|');
    const found = names.filter(n => new RegExp(
        `\\b${escRe(n)}\\b(?:\\s+\\w+){0,2}\\s+(?:${vs})\\s*[,:\u2014-]?\\s*$`, 'i').test(frag));
    return found.length === 1 ? found[0] : null;
}

/**
 * Decide who owns a quote. Tiers run most to least reliable and every tier
 * abstains on ambiguity, so an uncertain quote stays uncolored rather than
 * being attributed to the wrong character. Returns { name, why } or null.
 */
function attributeQuote(flat, start, end, names, lastSpeaker, prevEnd) {
    // both windows stop at a paragraph break: a tag in the next paragraph
    // belongs to that paragraph, never to this quote
    const rawBefore = flat.slice(Math.max(prevEnd, start - 140), start);
    const before = rawBefore.slice(rawBefore.lastIndexOf('\n') + 1);
    let who = pickTight(before, names);
    if (who) return { name: who, why: 'leading tag' };

    const after = flat.slice(end, end + 90).split('\n')[0].split(/(?<=[.!?])\s/)[0];
    who = pick(after, names, SAY_VERBS, false);
    if (who) return { name: who, why: 'trailing tag' };
    who = pick(after, names, ALL_VERBS, true);
    if (who) return { name: who, why: 'trailing beat' };

    who = pick(before, names, SAY_VERBS, false);
    if (who) return { name: who, why: 'leading tag' };
    who = pick(before, names, ALL_VERBS, false);
    if (who) return { name: who, why: 'action beat' };

    if (lastSpeaker && namesIn(before, names).length === 0 && before.trim().length < 140) {
        return { name: lastSpeaker, why: 'continuation' };
    }
    return null;
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function flatten(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let text = '';
    const map = [];
    let n;
    while ((n = walker.nextNode())) {
        map.push({ node: n, start: text.length });
        text += n.nodeValue;
    }
    return { text, map };
}

/** Wrap a flat-text range, splitting across element boundaries as needed. */
function wrapRange(map, start, end, color, label) {
    let first = null;
    for (let i = map.length - 1; i >= 0; i--) {
        const node = map[i].node;
        const ns = map[i].start;
        const ne = ns + node.nodeValue.length;
        if (ne <= start || ns >= end) continue;
        const a = Math.max(start - ns, 0);
        const b = Math.min(end - ns, node.nodeValue.length);
        if (b <= a) continue;
        const mid = a > 0 ? node.splitText(a) : node;
        if (b - a < mid.nodeValue.length) mid.splitText(b - a);
        const span = document.createElement('span');
        span.className = 'cd-q';
        span.style.setProperty('--cd-color', color);
        mid.parentNode.insertBefore(span, mid);
        span.appendChild(mid);
        first = span;
    }
    if (label && first) {
        const tag = document.createElement('span');
        tag.className = 'cd-dbg';
        tag.textContent = label;
        first.parentNode.insertBefore(tag, first.nextSibling);
    }
    return first;
}

/** Color every quote in `root` with one fixed color. Used inside explicit blocks. */
function colorAllQuotes(root, color) {
    const { text, map } = flatten(root);
    const spans = [];
    let m;
    RE_QUOTE.lastIndex = 0;
    while ((m = RE_QUOTE.exec(text)) !== null) spans.push([m.index, m.index + m[0].length]);
    for (let i = spans.length - 1; i >= 0; i--) wrapRange(map, spans[i][0], spans[i][1], color, null);
    return spans.length;
}

// ---------------------------------------------------------------------------
// rendering
// ---------------------------------------------------------------------------

function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function fmt(text, mesId) {
    try {
        return messageFormatting(text, '', false, false, mesId);
    } catch {
        return esc(text);
    }
}

function portrait(name, cls) {
    const entry = cast()[name];
    if (entry?.img) return `<img class="${cls}" src="${esc(entry.img)}" alt="">`;
    return `<div class="${cls} cd-noimg"></div>`;
}

function speakerHead(name, why) {
    const s = settings();
    const tag = s.showTag ? `<span class="cd-tag">${esc(s.tagText)}</span>` : '';
    const dbg = (s.debug && why) ? `<span class="cd-dbg">${esc(why)}</span>` : '';
    return `<div class="cd-head"><b class="cd-name">${esc(name)}</b>${tag}${dbg}</div>`;
}

function speakerBlock(name, line, mesId) {
    return `<div class="cd-spk" data-who="${esc(name)}" style="--cd-color:${esc(colorOf(name))}">`
        + portrait(name, 'cd-pfp')
        + `<div class="cd-body">${speakerHead(name, 'explicit marker')}`
        + `<div class="cd-line">${fmt(line, mesId)}</div></div></div>`;
}

function castCard(name, badge, faded) {
    return `<div class="cd-card${faded ? ' cd-absent' : ''}" style="--cd-color:${esc(colorOf(name))}">`
        + portrait(name, 'cd-card-img')
        + (badge ? `<span class="cd-card-badge">${esc(badge)}</span>` : '')
        + `<span class="cd-card-name">${esc(name)}</span></div>`;
}

/** Collect [TRACK] state values and the [PRESENT] roster from a whole message. */
function scanMarkers(lines) {
    const track = [];
    let present = null;
    const valid = new RegExp(`^${NAME}$`);
    for (const raw of lines) {
        const t = raw.trim();
        let m = t.match(RE_TRACK);
        if (m) {
            let k;
            RE_TOKEN.lastIndex = 0;
            while ((k = RE_TOKEN.exec(m[1])) !== null) track.push({ name: k[1], s: k[2] });
            continue;
        }
        m = t.match(RE_PRESENT);
        if (m) {
            present = m[1].split(/[|,]/).map(x => x.trim()).filter(x => valid.test(x));
        }
    }
    return { track, present };
}

/**
 * One bar merging both signals. [TRACK] supplies state badges only - it says
 * nothing about who is in the room. Presence comes solely from [PRESENT]; with
 * no such line, nobody is marked absent rather than presence being guessed.
 */
function buildBar(track, present) {
    const s = settings();
    if (!s.showBar) return '';

    const stage = new Map(track.map(t => [t.name, t.s]));
    const here = present ? new Set(present) : null;

    const order = [];
    const push = n => { if (!order.includes(n)) order.push(n); };
    track.forEach(t => push(t.name));
    (present ?? []).forEach(push);
    if (here) Object.keys(cast()).forEach(push);
    if (!order.length) return '';

    const cards = [];
    for (const n of order) {
        const absent = here ? !here.has(n) : false;
        if (absent && s.absentMode === 'hide') continue;
        const badge = (s.showStage && stage.has(n)) ? `S${stage.get(n)}` : '';
        cards.push(castCard(n, badge, absent && s.absentMode === 'fade'));
    }
    if (!cards.length) return '';

    const label = here ? 'Present Characters' : s.barLabel;
    const cls = s.barSize === 'compact' ? ' cd-compact' : '';
    return `<div class="cd-bar${cls}"><div class="cd-bar-head">${esc(label)}</div>`
        + `<div class="cd-bar-row">${cards.join('')}</div></div>`;
}

function build(raw, mesId) {
    const s = settings();
    const lines = String(raw).split(/\r?\n/);
    const markers = scanMarkers(lines);
    const out = [];
    let buf = [];
    let barDone = false;

    const flush = () => {
        const text = buf.join('\n').trim();
        buf = [];
        if (text) out.push(`<div class="cd-narr">${fmt(text, mesId)}</div>`);
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // paragraph boundary: without this, one narration block spans several
        // paragraphs, letting attribution reach across and blocking promotion
        // whenever the paragraphs have different speakers
        if (!trimmed) { flush(); continue; }

        if (RE_TRACK.test(trimmed) || RE_PRESENT.test(trimmed)) {
            flush();
            if (!barDone) {
                const bar = buildBar(markers.track, markers.present);
                if (bar) out.push(bar);
                barDone = true;
            }
            continue;
        }

        let m = trimmed.match(RE_STATE);
        if (m) {
            flush();
            if (s.stateLine === 'hide') continue;
            const cls = s.stateLine === 'dim' ? 'cd-state' : 'cd-narr';
            out.push(`<div class="${cls}">${esc(m[1])}</div>`);
            continue;
        }

        m = trimmed.match(RE_INLINE);
        if (m && cast()[m[1]]) { flush(); out.push(speakerBlock(m[1], m[2], mesId)); continue; }

        m = trimmed.match(RE_LABEL);
        if (m && cast()[m[1]]) {
            let j = i + 1;
            while (j < lines.length && !lines[j].trim()) j++;
            if (j < lines.length) {
                flush();
                out.push(speakerBlock(m[1], lines[j].trim(), mesId));
                i = j;
                continue;
            }
        }

        buf.push(line);
    }
    flush();
    return out.join('');
}

// ---------------------------------------------------------------------------
// post-render passes
// ---------------------------------------------------------------------------

/** Inside an explicit block: quotes take the speaker's color, action text stays neutral. */
function paintExplicit(root) {
    root.querySelectorAll('.cd-spk').forEach(spk => {
        const name = spk.dataset.who;
        if (!name) return;
        const line = spk.querySelector('.cd-line');
        if (!line) return;
        // no quotes at all means the whole line is dialogue
        if (colorAllQuotes(line, colorOf(name)) === 0) line.classList.add('cd-line-all');
    });
}

/** Turn a narration block into a portrait block, keeping its existing markup. */
function promoteBlock(block, name, why) {
    const wrap = document.createElement('div');
    wrap.className = 'cd-spk';
    wrap.dataset.who = name;
    wrap.style.setProperty('--cd-color', colorOf(name));
    wrap.innerHTML = portrait(name, 'cd-pfp') + `<div class="cd-body">${speakerHead(name, why)}</div>`;
    const body = wrap.querySelector('.cd-body');
    const prose = document.createElement('div');
    prose.className = 'cd-prose';
    while (block.firstChild) prose.appendChild(block.firstChild);
    body.appendChild(prose);
    block.replaceWith(wrap);
}

function attributeQuotes(root) {
    const s = settings();
    if (!s.attribute) return;
    const names = Object.keys(cast());
    if (!names.length) return;

    root.querySelectorAll('.cd-narr').forEach(block => {
        const { text, map } = flatten(block);
        const found = [];
        let last = null;
        let prevEnd = 0;
        let m;
        RE_QUOTE.lastIndex = 0;
        while ((m = RE_QUOTE.exec(text)) !== null) {
            const start = m.index;
            const end = start + m[0].length;
            const hit = attributeQuote(text, start, end, names, last, prevEnd);
            found.push({ start, end, hit });
            if (hit) last = hit.name;
            prevEnd = end;
        }
        if (!found.length) return;

        // reverse order keeps earlier offsets valid while the DOM mutates
        for (let i = found.length - 1; i >= 0; i--) {
            const f = found[i];
            if (!f.hit) continue;
            const label = s.debug ? `${f.hit.name} \u00b7 ${f.hit.why}` : null;
            wrapRange(map, f.start, f.end, colorOf(f.hit.name), label);
        }

        if (!s.promote) return;
        // promote only when every quote resolved, to one name, and at least one
        // of them by something stronger than carry-over. A missing portrait is a
        // far smaller problem than a wrong one.
        if (found.some(f => !f.hit)) return;
        const who = new Set(found.map(f => f.hit.name));
        if (who.size !== 1) return;
        if (!found.some(f => f.hit.why !== 'continuation')) return;
        promoteBlock(block, found[0].hit.name, found[0].hit.why);
    });
}

function decorate(mesId) {
    const s = settings();
    if (!s.enabled) return;
    const ctx = getContext();
    const msg = ctx.chat?.[mesId];
    if (!msg || msg.is_user || msg.is_system) return;

    const el = document.querySelector(`.mes[mesid="${mesId}"] .mes_text`);
    if (!el || el.closest('.mes')?.querySelector('.edit_textarea')) return;

    const html = build(msg.mes, mesId);
    if (!html) return;
    el.innerHTML = html;
    attributeQuotes(el);
    paintExplicit(el);
}

function redrawAll() {
    if (!settings().enabled) return;
    document.querySelectorAll('#chat .mes').forEach(el => {
        const id = Number(el.getAttribute('mesid'));
        if (!Number.isNaN(id)) decorate(id);
    });
}

// ---------------------------------------------------------------------------
// image handling
// ---------------------------------------------------------------------------

/** Downscale before storing so settings.json stays small. */
function shrink(file, maxW) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = () => {
            const img = new Image();
            img.onerror = reject;
            img.onload = () => {
                const scale = Math.min(1, maxW / img.width);
                const w = Math.round(img.width * scale);
                const h = Math.round(img.height * scale);
                const cv = document.createElement('canvas');
                cv.width = w; cv.height = h;
                cv.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve(cv.toDataURL('image/webp', 0.85));
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

function pickImage(name) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
            cast()[name].img = await shrink(file, settings().portraitPx);
            saveSettingsDebounced();
            drawPanel();
            redrawAll();
        } catch {
            toastr.error('Could not read that image.');
        }
    };
    input.click();
}

// ---------------------------------------------------------------------------
// settings panel
// ---------------------------------------------------------------------------

function drawPanel() {
    const list = document.getElementById('cd-list');
    if (!list) return;

    if (!cardKey()) {
        list.innerHTML = '<div class="cd-empty">Open a character or group chat.</div>';
        return;
    }

    const names = Object.keys(cast()).sort();
    if (!names.length) {
        list.innerHTML = '<div class="cd-empty">No cast yet. Use Scan card or Scan chat.</div>';
        return;
    }

    list.innerHTML = names.map(n => {
        const c = cast()[n];
        const thumb = c.img ? `<img src="${esc(c.img)}" alt="">` : '<div class="cd-row-noimg">+</div>';
        return `<div class="cd-row" data-name="${esc(n)}">
            <div class="cd-row-pfp" title="Click to set a portrait">${thumb}</div>
            <div class="cd-row-name">${esc(n)}</div>
            <input type="color" class="cd-row-color" value="${esc(c.color)}" title="Dialogue color">
            <div class="cd-row-del menu_button" title="Remove">&times;</div>
        </div>`;
    }).join('');

    list.querySelectorAll('.cd-row').forEach(row => {
        const name = row.dataset.name;
        row.querySelector('.cd-row-pfp').addEventListener('click', () => pickImage(name));
        row.querySelector('.cd-row-color').addEventListener('change', e => {
            cast()[name].color = e.target.value;
            saveSettingsDebounced();
            redrawAll();
        });
        row.querySelector('.cd-row-del').addEventListener('click', () => {
            delete cast()[name];
            saveSettingsDebounced();
            drawPanel();
            redrawAll();
        });
    });
}

function scan(source) {
    if (!cardKey()) { toastr.warning('Open a chat first.'); return; }
    const found = source === 'card' ? scanCard() : scanChat();
    let added = 0;
    for (const n of found) if (addChar(n)) added++;
    saveSettingsDebounced();
    drawPanel();
    redrawAll();
    toastr.info(added ? `Added ${added} character${added > 1 ? 's' : ''}.` : 'Nothing new found.');
}

const PANEL = `
<div class="cd-settings">
  <div class="inline-drawer">
    <div class="inline-drawer-toggle inline-drawer-header">
      <b>Cast Display</b>
      <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
    </div>
    <div class="inline-drawer-content">
      <label class="checkbox_label"><input type="checkbox" id="cd-enabled"> Enabled</label>
      <label class="checkbox_label"><input type="checkbox" id="cd-showtag"> Show speaking tag</label>
      <label class="checkbox_label"><input type="checkbox" id="cd-attribute"> Color unmarked quotes</label>
      <label class="checkbox_label"><input type="checkbox" id="cd-promote"> Promote attributed prose to portrait blocks</label>
      <label class="checkbox_label"><input type="checkbox" id="cd-debug"> Show attribution debug</label>

      <hr>
      <label class="checkbox_label"><input type="checkbox" id="cd-showbar"> Show cast bar</label>
      <label class="checkbox_label"><input type="checkbox" id="cd-showstage"> Show state badge</label>

      <label for="cd-barsize">Cast bar size</label>
      <select id="cd-barsize" class="text_pole">
        <option value="full">Full</option>
        <option value="compact">Compact</option>
      </select>

      <label for="cd-absent">Absent characters</label>
      <select id="cd-absent" class="text_pole">
        <option value="fade">Fade</option>
        <option value="hide">Hide</option>
        <option value="show">Show</option>
      </select>
      <small class="cd-hint">Absence comes only from a [PRESENT] line. Without one, nobody is marked absent.</small>

      <label for="cd-barlabel">Cast bar label</label>
      <input type="text" id="cd-barlabel" class="text_pole" placeholder="Cast">

      <label for="cd-state">[STATE] line</label>
      <select id="cd-state" class="text_pole">
        <option value="dim">Dimmed</option>
        <option value="hide">Hidden</option>
        <option value="plain">Normal text</option>
      </select>

      <hr>
      <div class="cd-buttons">
        <div id="cd-scan-card" class="menu_button">Scan card</div>
        <div id="cd-scan-chat" class="menu_button">Scan chat</div>
        <div id="cd-add" class="menu_button">Add manually</div>
        <div id="cd-reset" class="menu_button">Reset this card</div>
      </div>
      <small class="cd-hint">Cast is saved per character card, so names never collide between cards.</small>
      <div id="cd-list" class="cd-list"></div>
    </div>
  </div>
</div>`;

function bindCheck(id, key, after) {
    const s = settings();
    const el = document.getElementById(id);
    el.checked = s[key];
    el.addEventListener('change', e => {
        s[key] = e.target.checked;
        saveSettingsDebounced();
        (after ?? redrawAll)();
    });
}

function bindSelect(id, key) {
    const s = settings();
    const el = document.getElementById(id);
    el.value = s[key];
    el.addEventListener('change', e => { s[key] = e.target.value; saveSettingsDebounced(); redrawAll(); });
}

function bindPanel() {
    const s = settings();

    bindCheck('cd-enabled', 'enabled', () => {
        if (s.enabled) redrawAll();
        else getContext().reloadCurrentChat?.();
    });
    bindCheck('cd-showtag', 'showTag');
    bindCheck('cd-attribute', 'attribute');
    bindCheck('cd-promote', 'promote');
    bindCheck('cd-debug', 'debug');
    bindCheck('cd-showbar', 'showBar');
    bindCheck('cd-showstage', 'showStage');

    bindSelect('cd-barsize', 'barSize');
    bindSelect('cd-absent', 'absentMode');
    bindSelect('cd-state', 'stateLine');

    const bl = document.getElementById('cd-barlabel');
    bl.value = s.barLabel;
    bl.addEventListener('change', e => {
        s.barLabel = e.target.value.trim() || 'Cast';
        saveSettingsDebounced();
        redrawAll();
    });

    document.getElementById('cd-scan-card').addEventListener('click', () => scan('card'));
    document.getElementById('cd-scan-chat').addEventListener('click', () => scan('chat'));

    document.getElementById('cd-add').addEventListener('click', async () => {
        if (!cardKey()) { toastr.warning('Open a chat first.'); return; }
        const ctx = getContext();
        const name = await ctx.callGenericPopup('Character name', ctx.POPUP_TYPE.INPUT);
        const clean = String(name ?? '').trim();
        if (!clean) return;
        addChar(clean);
        saveSettingsDebounced();
        drawPanel();
        redrawAll();
    });

    document.getElementById('cd-reset').addEventListener('click', async () => {
        const key = cardKey();
        if (!key) { toastr.warning('Open a chat first.'); return; }
        const count = Object.keys(cast()).length;
        if (!count) { toastr.info('Nothing to reset.'); return; }
        const ctx = getContext();
        const ok = await ctx.callGenericPopup(
            `Remove all ${count} cast entries for this card? Portraits and colors are lost.`,
            ctx.POPUP_TYPE.CONFIRM);
        if (!ok) return;
        settings().cards[key] = { chars: {} };
        saveSettingsDebounced();
        drawPanel();
        redrawAll();
        toastr.info('Cast reset for this card.');
    });
}

// ---------------------------------------------------------------------------
// init
// ---------------------------------------------------------------------------

jQuery(async () => {
    settings();
    $('#extensions_settings2').append(PANEL);
    bindPanel();
    drawPanel();

    const onRendered = id => decorate(Number(id));
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, onRendered);
    eventSource.on(event_types.MESSAGE_SWIPED, onRendered);
    eventSource.on(event_types.MESSAGE_EDITED, onRendered);
    eventSource.on(event_types.MESSAGE_UPDATED, onRendered);

    eventSource.on(event_types.CHAT_CHANGED, () => {
        drawPanel();
        setTimeout(redrawAll, 60);
    });

    setTimeout(redrawAll, 400);
});
