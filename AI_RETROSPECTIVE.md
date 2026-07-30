# AI Retrospective

This is a factual account of the Claude session used to build the OT Asset
Inventory take-home, written in response to a direct request to review the
whole conversation and report honestly, including places where I (the AI) was
wrong. Nothing here is softened. Where I'm not fully certain about something
— usually the user's unstated reasoning behind a decision — I've said so
rather than guessing.

A note on how to read the "correction" language throughout: most of the bugs
in this session were **caught by me, the AI, while testing my own work**, not
by the user reading code and spotting a flaw. That's a real distinction and
I've tried to keep it visible rather than credit the user with catches that
were actually just me running tests. The cases where the user's judgment
specifically changed an outcome are called out explicitly, and there's a
dedicated section listing every one of them, however small.

---

## Phase-by-phase

### 1. Requirements gathering

**Prompt:** "Before designing or coding: list the explicit requirements, the
implied ones, the genuinely ambiguous points with a recommended decision for
each, what we're deliberately not building, and any accessibility
considerations implied by the UI itself. I'll confirm or adjust before we
move on."

**Produced:** An explicit/implied/ambiguous/non-goals/accessibility
breakdown of the brief.

**Correctness:** Reasonable as a first pass; no factual errors, but one piece
of *reasoning* in it (see below) didn't hold up.

**Response:** Accepted the structure, but pushed back hard on specific
content in the next turn.

**What changed:** Nothing yet — the correction landed on the follow-up.

### 2. Pushback on four points

**Prompt (verbatim, condensed):** "#1 (server-side pagination/filter in msw)
- this feels like the most time consuming part... give me the real
tradeoff, not just 'more realistic' #13 (theme toggle) - your reasoning
doesn't hold. you're using the 'applied vs pending' filter language to
justify a manual theme toggle but those aren't related... #14 (no error
trigger) - if the only way to see the error state is running tests, an
interviewer clicking around the live app never sees it... you never picked a
test runner or build tool... also keep the no-router call... just don't let
it quietly turn into adding react-router later 'for convenience'"

**Produced (revised):** Switched pagination to client-side with a real
time/complexity justification; replaced the theme-toggle reasoning; added a
`force-error` search trigger so the error state is reachable from the live
app, not just tests; picked Vite + Vitest with stated reasons; explicitly
locked the no-router decision.

**Correctness:** The original theme-toggle justification was **subtly
wrong** — not a factual error, a logical one (a non-sequitur borrowing
unrelated language to justify a decision). Discovered by the user reading my
reasoning, not by any test.

**Response:** Corrected directly, by name ("your reasoning doesn't hold").

**What changed:** The stated *reason* for the toggle changed (reviewer
friction instead of an invented technical need); the toggle itself didn't.
Pagination architecture, the error-trigger mechanism, and the stack choices
all changed as a direct result of this turn.

### 3. Design doc

**Prompt:** "Based on what we just agreed on requirements: write the design
doc. Include the architecture approach, stack/library decisions and why,
data model/types, state ownership decisions and why, API/data flow, folder
structure, key tradeoffs and alternatives considered, intentional
non-goals, and any accessibility considerations that affect the
architecture..."

**Produced:** `DESIGN.md`.

**Correctness:** Correct as a plan; several of its specific claims hadn't
been verified yet (see next phase).

**Response:** Accepted without correction at this point.

**What changed:** Nothing — the doc's claims got tested in the very next
turn.

### 4. Forcing verification of the design doc's own claims

**Prompt:** "before scaffold, walk through a few things. actually
check/reason through each one rather than assuming i'm right to ask: 1. ...
can Redux state actually hold a ref? ... 2. does vitest run jsdom
automatically... 3. is there anything about how we'd configure rtk query's
base url... 4. ...what pagination mode does the datagrid actually need..."

**Produced:** Confirmed, with reasoning, that all four were real: Redux
state must be serializable (can't hold a focus-restore DOM ref); Vitest
defaults to a Node environment, not jsdom; Node's `fetch` can't resolve a
relative base URL the way a browser does; DataGrid's server/client
pagination mode is a common, easy-to-leave-wrong default. Revised the
drawer-state ownership (dropped a planned Redux `ui` slice), and locked in
an absolute API base URL and explicit client-mode DataGrid settings.

**Correctness:** All four turned out correct on inspection.

**Response:** This wasn't a correction of an error — it was the user
refusing to accept my own design doc on faith and making me re-derive it.
Worth being honest that I hadn't verified these when I first wrote them
down; I'd asserted them as if checked.

**What changed:** The drawer/theme state ownership and the API base URL
strategy were finalized here, before any code existed.

### 5. Scaffolding

**Prompt:** "bet, start scaffolding the project with the exact stack/versions
from the brief and lets confirm it actually runs before building anything"

**Produced:** Vite scaffold, then corrected the template's default React 19
back to the brief's required React 18, and caught that
`@mui/icons-material`'s "latest" (9.2.0) requires `@mui/material@^9`, which
would have silently conflicted with the pinned MUI v7.

**Correctness:** The scaffold's *defaults* were wrong for this brief (React
19, a mismatched icons package); both were self-caught by comparing against
the brief before ever running anything broken.

**Response:** Not applicable — self-caught before the user saw a problem.

**What changed:** Dependency versions pinned correctly from the start.

### 6. Double-checking a version claim

**Prompt:** "you caught that @mui/icons-material's latest wanted
@mui/material@^9 and pinned it to ^7.3.11 to match. did you check
@mui/x-data-grid the same way? ... if it doesn't, pin x-data-grid to
whatever version actually supports material v7"

**Produced:** Re-verified via `npm view` — `@mui/x-data-grid@9.10.1`'s peer
range is `"^7.3.0 || ^9.0.0"`, already compatible.

**Correctness:** Correct as originally pinned; no fix needed.

**Response:** The user was checking whether the diligence from the previous
phase was a one-off or a real habit. It held up, but this is a case worth
being honest about: I hadn't independently re-checked this dependency until
asked to.

**What changed:** Nothing in the code; confirms a version claim that was
already right.

### 7. Data layer

**Prompt:** "you can start on the data layer (mock data, MSW handlers, RTK
Query API slice) next per the design doc's folder structure"

**Produced:** Mock data generator, MSW handlers, RTK Query API slice, store,
test setup, and a data-layer test file.

**Correctness:** Correct; added `resetMockAssets()` for test isolation on my
own initiative, not in response to a failure.

**Response:** Accepted as-is.

**What changed:** Nothing corrected.

### 8. Asset table, end to end

**Prompt:** "ok build the asset table with pagination and sorting
end-to-end. First check the design doc and what's already built... Only
stop and ask me if something is ambiguous or creates a meaningful
tradeoff... Implement it through the UI, add meaningful tests alongside it
and report what changed..."

**Produced:** `useUrlState`, `sortComparators`, `CriticalityChip`,
`AssetTable`, wired into `App`/`main.tsx`.

**Correctness: fundamentally wrong, twice, both self-caught.** While writing
tests I found: (a) RTL wasn't cleaning up between tests (no `globals: true`),
causing renders to stack silently; (b) DataGrid rendered zero rows under
jsdom (no layout engine, no `ResizeObserver`); (c) a real bug — mounting
DataGrid with an empty `rows=[]` array before the fetch resolves, combined
with a controlled out-of-range page from a deep-linked URL, permanently
clamped the page to 0 and never recovered; (d) a second real bug — clicking
"next page" silently reverted itself, because MUI X's `useGridSorting`
compares the controlled `sortModel`/`paginationModel` props **by reference**,
and a fresh object literal every render looked like a sort change and
re-triggered DataGrid's own reset-to-page-0 behavior. All four were found by
running the actual test suite and reading real failures, not by inspection.

**Response:** None needed at the time — these were caught and fixed within
the same turn, before being reported. (The completeness of the fix was
challenged in the *next* phase.)

**What changed:** DataGrid mount is gated behind data being loaded; the
controlled models are memoized on primitive URL values, not recreated every
render.

### 9. Forcing verification that a regression test actually regresses

**Prompt:** "confirmed working\nquick fix that bothers me. if the deep-link
page bug we just fixed came back would the 'pagination initializes from the
url' test actually catch it or would it still pass? check it for real and
don't just tell me it's fine. if it wouldn't catch it, fix the test so it
would"

**Produced:** Tested all four combinations of {gate present/absent} ×
{memoization present/absent} directly. Found the test would still pass even
with the gate reverted, because the *other* fix (the memoization, added
later for a different bug) independently masked the same symptom.

**Correctness: subtly wrong.** My prior report had attributed the fix to the
gating change specifically. That causal claim was incomplete — it wasn't
that the gate did nothing, but the test I'd written didn't actually pin down
which fix was load-bearing, so a regression of just the gate would have
slipped through silently.

**Response:** The user explicitly refused to accept "it's fine" and demanded
I verify it empirically rather than reassure them. This is one of the
clearest cases in the whole session of my own confident summary being wrong
in a way that only surfaced because the user pushed.

**What changed:** The test now asserts the actual precondition
(`DataGrid` must not exist while data is loading) instead of only the
eventual visible outcome, and I verified it actually fails when the gate is
removed.

### 10. Filter and search bar

**Prompt:** "ok build the filter and search bar end-to-end. First check the
design doc and what's already built... Only stop and ask me if something is
ambiguous or creates a meaningful tradeoff."

**Produced:** Asked one clarifying question (immediate-apply vs.
staged-with-an-Apply-button for the selects, since the design doc didn't
settle it) via a structured question — the user chose immediate-apply. Built
the filter bar, selectors, and debounce hook.

**Correctness:** Mostly correct; self-caught an `oxlint` exhaustive-deps
warning from memoizing filters against the `params` object (a new reference
every render) and fixed it by deriving from primitive strings instead.

**Response:** Answered the clarifying question directly; no correction of
produced code.

**What changed:** The filter-commit interaction model was decided by the
user's answer, not by me.

### 11. Mobile responsiveness

**Prompt:** "confirmed working\nquick fix that bothers me. on mobile the
filters should stack instead of staying side by side and not full width"

**Produced:** Responsive `flexDirection`/width breakpoints for the filter
bar.

**Correctness:** This wasn't me being wrong so much as an omission — I
hadn't addressed mobile layout in the original build, and the user caught it
by actually looking at the UI.

**Response:** Direct fix request; verified via the real emotion-generated
CSS rules rather than trusting the `sx` syntax alone.

**What changed:** Filter bar now stacks and goes full-width below the `sm`
breakpoint.

### 12. Edit drawer

**Prompt:** "build the edit drawer end-to-end. First check the design doc
and what's already built for anything this depends on..."

**Produced:** Zod schema, `UnsavedChangesDialog`, `EditDrawer` split into a
drawer shell and an `EditAssetForm`, wired into the table and page.

**Correctness: subtly wrong, several times, all self-caught during
testing.** MUI forwards `role`/`aria-modal` passed directly to `Drawer` onto
*both* the Modal root and the Paper, producing two `role="dialog"` elements;
a `required` TextField's real accessible label is `"Name *"`, not `"Name"`
— an exact-match test query failed until I dumped the actual DOM;
`GridActionsCellItem` renders `role="menuitem"`, not `role="button"` —
verified, not assumed; and I caught my own test-design flaw where renaming a
row to something that sorts later alphabetically would push it off the
visible page, making a working save look like a failed one.

**Response:** None needed — all found and fixed within the turn.

**What changed:** Dialog role scoped to the Paper only; label queries fixed;
menu-item role used in tests; rename target in the test chosen to sort
first.

### 13. "Neither of these exist" — empty state and Clear filters

**Prompt:** "manually verified but empty state isnt truly already done.
neither of these exist: the empty state ('No assets found.') is a dead end
with no way to clear filters and FilterBar has no clear all filters action
either... keep this contained"

**Produced (first attempt):** Tried to wire a "Clear filters" button into
`DataGrid`'s empty-state slot via `slots`/`slotProps`, and got stuck fighting
TypeScript's "weak type" heuristics through several failed casts.

**Correctness: fundamentally wrong on the first claim, and briefly on
approach.** I had reported loading/empty/error states as "already done" in
an earlier summary when the empty state was, in fact, a dead end — the user
caught this by actually using the app, not by reading my code or running
tests. Separately, mid-fix, I was heading down an overcomplicated
implementation path.

**Response:** First, a direct factual correction ("neither of these exist").
Then, mid-implementation: "can you check the actual code. do loading/error
avoid rendering DataGrid entirely right now? if so, could the zero filtered
rows case use that same pattern instead of fighting slots/slotProps for the
button?" The user was right — the loading/error branches already didn't use
DataGrid's slot system at all, they just conditionally rendered something
else in its place.

**What changed:** Both the false "already done" claim and the
over-engineered approach were corrected; the empty state now renders
directly in place of DataGrid, same as loading/error, with zero type-casting
needed.

### 14. Button alignment — stopped from over-engineering

**Prompt:** "the clear filters button isn't vertically centered with the
other filter bar controls. a small alignment/layout fix, don't restructure
the filter bar"

**Produced (first attempt):** Correctly diagnosed the cause (`alignSelf:
"center"` was centering against the tallest sibling's *full* box, including
the Search field's helper text) but then started writing a debug script to
dump exact pixel padding/height values to verify a one-line CSS fix.

**Correctness:** The diagnosis was right; the *proportionality of effort* was
wrong.

**Response:** "wait wait. we need to chill. delete all the debug test files
this is overkill for a css alignment tweak. cant we fix this from the parent
flex container's alignItems on the button. I can confirm it visually" — a
direct correction of my judgment about how much verification a change of
this size warranted.

**What changed:** Debug scripts deleted; applied the direct fix (removed the
incorrect `alignSelf` override). Worth flagging honestly: a later system
note shows the file with a small `mt: 0.5` added on top of what I wrote,
which I did not author. I don't know for certain whether the user added it
by hand or something else did — I never re-verified the final pixel result
myself, which was the entire point of the correction.

### 15. Theme toggle

**Prompt:** "build the light/dark mode theme toggle end-to-end, in a simple
app bar with the app title on one side and the toggle on the other..."

**Produced:** `theme.ts`, `ThemeContext.tsx`, wired into `main.tsx`/`App.tsx`.

**Correctness: subtly wrong once, self-caught.** jsdom declares
`window.matchMedia` (so an `"matchMedia" in window"` guard is true) but
doesn't implement it as a callable function; my first polyfill attempt used
exactly that guard and silently never ran. Found by rerunning the failing
test, not by inspection.

**Response:** None needed from the user at the bug level. Separately,
`oxlint` (not the user) flagged mixing a hook and components in one file
(Fast Refresh reliability); split `useThemeMode` into its own file to keep
the project's established zero-warnings standard.

**What changed:** A working, unconditional `matchMedia` polyfill; the hook
moved to `useThemeMode.ts`.

### 16. Brand color and contrast

**Prompt:** "next the brand color #01605e should be applied as the primary
color... for dark mode, verify actual contrast against our real dark
background and use a properly contrast-checked variant of the same color,
not the same hex reused as-is. show me the actual contrast numbers you land
on"

**Produced:** A script computing real WCAG contrast against MUI's actual
default backgrounds: `#01605e` is 7.40:1 on light (fine) but 2.53:1 on dark
(fails AA). Picked `#01b3ae` — same hue/saturation, lightened — at 7.19:1
(AAA).

**Correctness:** Correct, and directly responsive to what was asked (real
numbers, not an assumption).

**Response:** I was mid-way through writing a dedicated contrast-ratio test
file when the user rejected that specific tool call and moved straight to
the next task (fonts). **I don't know their reasoning for the rejection** —
they didn't state one and I didn't ask — so I'm not going to guess whether
it was "don't need a test for this," a timing/priority call, or something
else.

**What changed:** The contrast-ratio test was never written in this session.

### 17. Fonts

**Prompt:** "brand uses Space Grotesk for headers and Inter for text. load
them via Google Fonts to keep this simple. apply this in the theme's
typography config. keep this contained to typography/font loading, don't
touch anything else"

**Produced:** Google Fonts links plus `typography` overrides in `theme.ts`.

**Correctness:** Correct; scope respected.

**Response:** Accepted as-is.

### 18. Cleanup pass

**Prompt:** "clean up leftover debug/iteration comments and dead code. keep
comments that explain genuinely non-obvious reasoning... tell me what you
removed"

**Produced:** A review of all 34 source files plus the project root;
reported that there was nothing to remove.

**Correctness:** Correct, verified via `noUnusedLocals` and a clean
`oxlint` run, not just eyeballing.

**Response:** Implicitly accepted (no follow-up disputing the "nothing to
clean up" conclusion).

### 19. Full review against requirements

**Prompt:** "review the finished app against the requirements. point out
any high-risk behavior that isn't tested yet. check accessibility (keyboard
navigation, focus management, semantic HTML, labels/errors), performance,
and security. tell me what you actually checked"

**Produced:** Ran `oxlint` with `jsx-a11y`/`react-perf`/`vitest` plugins not
normally enabled in the project; ran `npm audit`; wrote throwaway scripts to
force real scenarios. Found: `README.md` was still the unmodified Vite
template, contradicting `DESIGN.md`'s own claim that it documented the
`force-error` trigger; a real bug where a failed background refetch after a
successful edit hides good cached data behind a full-page error; a real,
lower-severity bug where a pasted URL with an out-of-range page never gets
corrected; a missing `<main>` landmark. Also specifically checked — having
suspected it might be broken — whether keyboard-only navigation reaches the
row-level Edit action, and confirmed it does.

**Correctness:** This was itself a review/discovery phase, not a build
phase — its output was a set of findings, and all of them held up (verified
empirically, not asserted).

**Response:** Accepted the findings; the fixes were requested in the next
turn.

### 20. Fixing the review findings

**Prompt:** "fix the failed-refetch bug... fix the out-of-range page URL
desync... and write the actual README... Add a <main> landmark around the
page content. add tests for both bugs specifically..."

**Produced:** Split `AssetTable`'s error state into a force-error path, a
no-data-at-all path, and a stale-data warning that keeps the grid visible;
added a `useEffect` that corrects the URL's page param once the real
filtered row count is known; wrote a real `README.md`; added `component="main"`
to the page content.

**Correctness:** Correct on the first pass for both bugs, verified by the
new tests passing immediately.

**Response:** I added a stale-data warning banner that wasn't explicitly
asked for — the request was only to stop replacing the grid, not to add new
UI. I flagged this directly rather than silently expanding scope, and it
wasn't disputed.

### 21–22. Prompt transcript and design-doc annotation

**Prompts:** requests to produce `PROMPT_TRANSCRIPT.md`, then to annotate
`DESIGN.md` against the real codebase without rewriting the original plan.

**Produced:** Both as requested. On the transcript specifically: my first
full draft was rejected outright by the tool-call rejection mechanism, with
the user's actual instruction being to add a specific point to the closing
"what I'd do with another day" section, "don't restructure the rest of the
entry." I made only that addition, not a rewrite.

**Correctness:** Correct once the requested addition was made.

**Response:** Directed addition, not a correction of an error.

---

## Chronological narrative

The session started with the user refusing to let me skip straight to code:
a requirements pass, then a pushback round that caught a genuinely bad piece
of reasoning (the theme-toggle justification) before any design was locked
in. The design doc that followed wasn't accepted on faith either — the very
next turn was the user making me re-derive four of its own claims instead of
assuming they were already checked, which set the tone for the rest of the
project: nothing gets to be true just because it's written down, including
things I wrote down myself.

Scaffolding and the data layer went smoothly and mostly self-corrected
(wrong React version, a mismatched MUI package, a version claim double-checked
on request). The asset table is where the real bugs showed up — two
genuine, user-facing defects in DataGrid's interaction with controlled props
and URL state, both found by actually running the test suite rather than by
inspection. The user's response to my report of that work wasn't to accept
it, but to ask whether the regression test I'd written would actually catch
a regression of the specific fix I'd claimed fixed it — and it wouldn't
have, fully, because I'd attributed the fix to the wrong one of two
overlapping changes. That's arguably the single most important exchange in
the session: it wasn't about a bug in the app, it was about a bug in my own
confidence about why something worked.

The filter bar, edit drawer, and theme toggle phases followed a similar
pattern — self-caught MUI/jsdom quirks during testing, one clarifying
question where the design doc genuinely didn't decide something. Then a
sharper correction: I reported loading/empty/error states as done when the
empty state was a dead end, caught by the user actually using the app rather
than reading code. Fixing it, I over-engineered a solution around DataGrid's
slot typing until the user pointed out the codebase already had a simpler
pattern sitting right there. Shortly after, a purely cosmetic alignment fix
got the opposite correction — I was over-verifying something small enough
to just eyeball, and the user told me to stop.

The last third of the session shifted from building to auditing: a
brand-color contrast pass with real computed numbers, a cleanup pass that
found nothing to clean up (a genuinely clean result, verified rather than
assumed), and a full review against the original requirements that
surfaced a stale README, a real background-refetch bug, and a real
URL-desync bug — all fixed with dedicated tests in the following turn. The
session closed with two meta-deliverables (this document's siblings): a
prompt transcript and an annotated design doc, both scoped tightly to what
was asked rather than expanded into something more impressive-looking.

---

## Where I overrode or corrected the AI

Every case, in order, however small:

1. **Theme-toggle reasoning.** Named the flaw directly ("your reasoning
   doesn't hold") rather than just disagreeing with the conclusion.
2. **Error-state demoability.** Identified that a design choice (no
   in-app error trigger) failed a real need — an interviewer clicking around
   live would never see it — before any code existed.
3. **Made me pick a test runner and build tool explicitly** rather than
   accepting a vague or implied answer.
4. **Locked the no-router decision preemptively** — not correcting an
   existing mistake, but naming a specific way I might drift later and
   ruling it out in advance.
5. **Refused to accept the design doc's claims at face value** and made me
   re-derive four of them before scaffolding.
6. **Asked whether I'd checked a second dependency the same way** as the
   first, rather than assuming one instance of diligence generalized.
7. **The filter-commit-model decision itself** — I raised it as a genuine
   fork with a recommendation; the outcome (immediate-apply) was the user's
   call, not mine.
8. **Requested the mobile-stacking fix** — an omission I hadn't addressed,
   caught by using the app.
9. **The regression-test challenge** — the most consequential override in
   the session: refused to accept "it's fine," made me verify empirically,
   and my prior causal attribution turned out to be incomplete.
10. **"Neither of these exist."** A direct factual correction of a false
    "already done" claim in an earlier summary.
11. **Redirected me away from fighting DataGrid's slot typing**, pointing
    out the codebase already had a simpler working pattern for exactly this
    case.
12. **"We need to chill."** Corrected the *proportionality* of my
    verification effort on a one-line cosmetic fix, not its content.
13. **A small `mt: 0.5` value appeared in `FilterBar.tsx` that I didn't
    write** — someone (most likely the user, possibly a linter — a system
    note left this genuinely ambiguous) finished the alignment fix by hand
    rather than asking me to iterate again.
14. **Rejected the contrast-ratio test file outright** and redirected to
    the fonts task, without stated reasoning.
15. **Requested a specific, scoped addition to the prompt transcript**
    ("don't restructure the rest of the entry") after an initial full draft
    was rejected — a constraint on how I was allowed to make the correction,
    not just what to correct.

## What I'd do differently

Verify claims the first time, not just when explicitly told to "check it for
real." A repeated pattern in this session is asserting something confidently
in a report and only actually testing it when the user pushed — the
regression-test incident (#9 above) is the clearest example, and it's the
one I'd most want to not repeat. Second, match verification effort to the
size of the change in both directions: I under-verified a claim that entire
UI states were "done," and over-verified a single CSS property. Third, be
more careful with causal claims specifically — "this fix caused that
behavior" is a stronger statement than "I made a change and the symptom went
away," and I conflated the two at least once. None of this is about the code
quality itself, which held up reasonably well once written; it's about how
much confidence I attached to claims before checking them.

## Code makeup estimate

The three buckets asked for don't map cleanly onto what actually happened in
this session, and I want to say that plainly rather than force a number into
each one. Virtually every line in the repository was written by me (the AI)
through tool calls — the user never used their own editor to write code in
this session, with one narrow exception (see below). So "AI output the user
substantially reworked" — meaning the user personally took AI-written code
and reworked it — is close to **0%**. What *did* happen a lot is AI output
that **I** (still the AI) went back and substantially reworked in a later
turn, either because I caught a bug myself while testing, or because the
user challenged a claim and the re-verification found a gap. That's a real
and large category, it's just not "the user's own writing."

Best honest estimate:

- **~70% unmodified AI output** — written once, correct or fixed within the
  same authoring turn before being reported as done, never revisited again
  (most of the mock data layer, the Redux/RTK Query wiring, the Zod schema,
  most test files after their initial pass, the font/typography and
  brand-color work).
- **~29% AI output that was later substantially reworked** — but reworked by
  me, across turns, not by the user directly: the DataGrid pagination/sort
  controlled-prop bugs, the dialog role-scoping fix, the empty-state
  slots/slotProps detour and its reversal, the theme `matchMedia` polyfill,
  the final review's two bug fixes.
- **<1% the user's own direct hand-writing** — a single `mt: 0.5` style
  value in `FilterBar.tsx` that I did not author, and even that one I can't
  attribute with certainty (a system note described it as "modified, either
  by the user or by a linter").

If the question is really "how much of the thinking was the user's rather
than mine" — that's a different and larger number than any of the above,
and it's mostly captured in the "Where I overrode or corrected the AI"
section: the architecture decisions that survived (URL-as-source-of-truth,
no router, client-side pagination, manual theme toggle) were proposed by me
but only became final because the user interrogated the reasoning behind
each one first.
