// Now retrieve all IDs of asciinema casts
const allcasts = new Map();

function mountCast(slide) {
// Slide is the slide being navigated
var slideNumber = slide.getSlideIndex();
var visible = document.getElementsByClassName("remark-visible")[0];
if (!visible) {
    return;
}
var element = visible.getElementsByClassName('asciicast')
if (element.length == 0 ) {
    return;
}

if (allcasts.has(slideNumber)) {
    allcasts.get(slideNumber).play();
    return;
}

var castEl = element[0];
var castid = castEl.attributes["id"].value;
// Per-cast playback speed via `data-speed` on the .asciicast div; default 1.
var speed = parseFloat(castEl.dataset.speed) || 1;
// Longest pause kept, in seconds, via `data-idle`; default 8. Longer pauses in
// the recording are compressed to this, before `speed` applies.
var idle = parseFloat(castEl.dataset.idle) || 8;
// `data-auto` defaults to true; only the explicit string "false" disables it.
var auto = castEl.dataset.auto !== "false";
var rows = parseInt(castEl.dataset.rows) || 20;
var cols = parseInt(castEl.dataset.cols) || 100;
allcasts.set(slideNumber, AsciinemaPlayer.create(
    `images/${castid}.cast`,
    document.getElementById(castid),
    { autoPlay: auto, speed: speed, idleTimeLimit: idle, rows: rows, cols: cols }
));

}

slideshow.on('afterShowSlide', mountCast);

// remark shows the first slide (or the one in the URL hash) before this script
// runs, so that slide never fires afterShowSlide here: mount it now, or a deck
// reloaded on a cast slide shows an empty box until you leave and come back.
var castInitialSlide = slideshow.getSlides()[slideshow.getCurrentSlideIndex()];
if (castInitialSlide) {
    mountCast(castInitialSlide);
}

slideshow.on('beforeHideSlide', function (slide) {
// Slide is the slide being navigated
var slideNumber = slide.getSlideIndex();
if (allcasts.has(slideNumber)) {
    allcasts.get(slideNumber).pause();
}
});
