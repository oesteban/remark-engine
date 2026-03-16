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

var castid = element[0].attributes["id"].value;
allcasts.set(slideNumber, AsciinemaPlayer.create(
    `images/${castid}.cast`,
    document.getElementById(castid),
    { autoPlay: true, speed: 1, idle_time_limit: 8, rows: 24, cols: 100 }
));

});
slideshow.on('beforeHideSlide', function (slide) {
// Slide is the slide being navigated
var slideNumber = slide.getSlideIndex();
if (allcasts.has(slideNumber)) {
    allcasts.get(slideNumber).pause();
}
});
