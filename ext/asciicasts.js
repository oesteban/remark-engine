// Now retrieve all IDs of asciinema casts
const allcasts = new Map();

slideshow.on('afterShowSlide', function (slide) {
// Slide is the slide being navigated
var slideNumber = slide.getSlideIndex();
var element = document.getElementsByClassName("remark-visible")[0].getElementsByClassName('asciicast')
if (element.length == 0 ) {
    return;
}

if (allcasts.has(slideNumber)) {
    allcasts.get(slideNumber).play();
    return;
}

var castEl = element[0];
var castid = castEl.attributes["id"].value;
// Per-cast playback speed via `data-speed` on the .asciicast div; default 4.
var speed = parseFloat(castEl.dataset.speed) || 1;
// `data-auto` defaults to true; only the explicit string "false" disables it.
var auto = castEl.dataset.auto !== "false";
var rows = parseInt(castEl.dataset.rows) || 20;
var cols = parseInt(castEl.dataset.cols) || 100;
allcasts.set(slideNumber, AsciinemaPlayer.create(
    `images/${castid}.cast`,
    document.getElementById(castid),
    { autoPlay: auto, speed: speed, idle_time_limit: 8, rows: rows, cols: cols }
));

});
slideshow.on('beforeHideSlide', function (slide) {
// Slide is the slide being navigated
var slideNumber = slide.getSlideIndex();
if (allcasts.has(slideNumber)) {
    allcasts.get(slideNumber).pause();
}
});
