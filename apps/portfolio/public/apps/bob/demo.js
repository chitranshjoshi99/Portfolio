// The demo on Bob's landing page: plays while it's on screen (never by itself for readers who asked for less motion), and
// the step list under it follows along and jumps to a step. demo.mp4 is still frames of the real Bob; its scene times are
// the data-at values, from the script that made it.
const video = document.getElementById("demo-video");
const play = document.getElementById("demo-play");
const steps = [...document.querySelectorAll("#demo-steps button")];
const at = steps.map((b) => Number(b.dataset.at));
// The reader's own Pause sticks while they scroll past and back.
let held = matchMedia("(prefers-reduced-motion: reduce)").matches;

const start = () => video.play().catch(() => {}); // a refused autoplay leaves the Play button

new IntersectionObserver(([e]) => (e.isIntersecting ? held || start() : video.pause()), { threshold: 0.4 }).observe(video);

play.addEventListener("click", () => {
  held = !video.paused;
  held ? video.pause() : start();
});
video.addEventListener("play", () => (play.textContent = "Pause"));
video.addEventListener("pause", () => (play.textContent = "Play"));

video.addEventListener("timeupdate", () => {
  const t = video.currentTime;
  const i = Math.max(0, at.findLastIndex((s) => s <= t));
  const end = at[i + 1] ?? video.duration;
  steps.forEach((b, j) => (j === i ? b.setAttribute("aria-current", "step") : b.removeAttribute("aria-current")));
  steps[i].style.setProperty("--p", Math.min(1, (t - at[i]) / (end - at[i])).toFixed(3));
});

steps.forEach((b, i) =>
  b.addEventListener("click", () => {
    video.currentTime = at[i];
    held = false;
    start();
  }),
);
