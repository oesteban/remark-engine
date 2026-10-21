# remark-engine

A shared [remark.js](https://remarkjs.com/) presentation engine — CSS themes, macros, and extensions — consumed as a **git submodule** by multiple presentation repositories.

## Quick start

```html
<head>
  <link rel="stylesheet" href="remark-engine/core/base.css" />
  <link rel="stylesheet" href="remark-engine/themes/chuv.css" />
  <!-- optional extensions: -->
  <link rel="stylesheet" href="remark-engine/ext/roulette.css" />
</head>
<body>
  <textarea id="source">... slides ...</textarea>

  <script src="https://remarkjs.com/downloads/remark-latest.min.js"></script>
  <script src="remark-engine/core/engine.js"></script>
  <!-- optional extensions (load after engine.js): -->
  <script src="remark-engine/ext/stepwise-svg.js"></script>
  <script src="remark-engine/ext/roulette.js"></script>
  <script>Roulette.init(slideshow);</script>
</body>
```

## Structure

```
core/
  base.css        Theme-agnostic layout, typography, utilities (CSS custom properties),
                  print layout
  engine.js       Macros + remark.create() wrapper + MathJax auto-config + printing
themes/
  chuv.css        Green accent (#009933)
  hes-so.css      Magenta accent (#dc0069)
  hesso-master.css HES-SO Master: blue accent (#00609c), slate headings, Inter, cover angles
  nipreps.css     Blue accent (#1c487b)
  ohbm2026.css    OHBM 2026 blue (#2e3192)
  indos.css       INDoS COST Action: purple accent (#5D288F), navy headings
ext/
  nav-controls.js Bottom bar (first, previous, slide number, next, last, fullscreen,
                  print) and a print button in the presenter toolbar
  nav-controls.css Bar styles
  stepwise-svg.js Progressive SVG element reveal
  svg-preload.js  Load every <object> SVG at startup, so that Ctrl+P prints them
  svg-theme.js    Recolour <object> SVGs with the theme's accent
  roulette.js     Timed speaking roulette + group formation
  roulette.css    Roulette UI styles
  asciicasts.js   Auto-discover & mount .cast terminal recordings
                  (images/<id>.cast; data-speed, data-idle, data-rows,
                  data-cols, data-auto on the .asciicast div)
  timer.js        Countdown timer for slides
vendor/
  asciinema-player/  Vendored player CSS + JS
tools/
  check-print.sh  Print a deck in headless Chrome and check the result
```

## Printing

Print with the printer button on the bar (it shows when the pointer reaches the
bottom edge) or, in presenter mode (press P), with the one next to the notes' `+`
and `-`. The mode decides what prints:

| mode | prints |
|---|---|
| audience view | the slides, one per page at their own size (1210 x 681 px) |
| presenter mode | a handout: each slide small on the left, its notes on the right; portrait by default, landscape works too |

The handout prints a slide that is built up over several slides once, in its
last build. A build is a `--` increment, or a copy of the slide marked
`count: false` under the same title. Notes written only on an earlier copy print
above those of the last build.

Printing leaves the screen as it was: `core/engine.js` switches off the rescaling
remark does when printing starts.

**The buttons wait for the SVGs; Ctrl+P cannot.** Chrome does not load an
`<object>` on a slide that has not been shown, so that slide prints its SVG
blank. The buttons load every SVG before they open the print dialog. A deck that
also loads `ext/svg-preload.js` loads them at startup, so Ctrl+P prints them too.

`tools/check-print.sh <deck-dir>`, run from the directory that serves the deck,
prints it both ways in headless Chrome, and in Firefox when it is installed. It
checks that the screen is unchanged afterwards, the page counts, the width each
print is laid out at, that no page is blank and the handout keeps its margins,
and that the buttons wait for the SVGs. It leaves the PDFs and their pages, as
PNG, in `_preview/print/`.

## Roster (`ext/roulette.js`)

`roulette.js` picks names from a roster it **fetches at run time**, relative to
the deck's own URL. Two file names are tried, in order:

| file | holds | in git |
|---|---|---|
| `roster.local.yml` | the real names | **never**, add it to `.gitignore` |
| `roster.yml` | a synthetic placeholder | tracked, published with the deck |

The first one that parses to a non-empty list wins; a missing local file is the
normal case and costs one 404. Both live next to the deck, so a repository with
several decks symlinks one file into each directory.

> **A consuming repository that is public must ignore `roster.local.yml`.**
> Whatever is committed is served to anyone who opens the deck. Ignoring the
> file is what makes `git add` refuse it: `git add -A` and `git add .` skip it,
> and `git add roster.local.yml` exits non-zero. Keep the tracked `roster.yml`
> synthetic so the published deck still has names to draw.

The lists are `attendees`, `observers` and `organizers`. Names may carry a
trailing `# comment`, which is stripped.

## Theming

`core/base.css` uses CSS custom properties. Theme files override `:root` variables only:

| Variable | Purpose | Default |
|---|---|---|
| `--accent` | Primary color | `#009933` |
| `--accent-dim` | Dimmed variant | `#00993320` |
| `--accent-dark` | Links | `var(--accent)` |
| `--heading-color` | Headings | `#738373` |
| `--logo-url` | Logo overlay | `none` |
| `--accent-a`, `--accent-a-light`, `--accent-b`, `--accent-b-light` | Secondary SVG colour channels read by `ext/svg-theme.js` | per-accent map |

## License

MIT
