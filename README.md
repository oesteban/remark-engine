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
  base.css        Theme-agnostic layout, typography, utilities (CSS custom properties)
  engine.js       Macros + remark.create() wrapper + MathJax auto-config
themes/
  chuv.css        Green accent (#009933)
  hes-so.css      Magenta accent (#dc0069)
  nipreps.css     Blue accent (#1c487b)
ext/
  stepwise-svg.js Progressive SVG element reveal
  roulette.js     Timed speaking roulette + group formation
  roulette.css    Roulette UI styles
  asciicasts.js   Auto-discover & mount .cast terminal recordings
  timer.js        Countdown timer for slides
vendor/
  asciinema-player/  Vendored player CSS + JS
```

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

## License

MIT
