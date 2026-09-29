# Gym Timer

An editable interval timer for the gym that runs in a phone browser. Plain HTML, CSS and JavaScript with no build step and no dependencies.

## Features

- **Saved intervals**, named by their setup: `high x low x sets` (for example `30s x 15s x 8`).
- **+ button** to create a new interval; **Edit** to change or delete one.
- **Scroll wheels** for high intensity, low intensity, warm up and cool down, in 5 second steps up to 1 minute (warm up and cool down can also be turned off).
- **Audio cues**: two dings when high intensity starts, one ding when low intensity starts, a lower ding for cool down and a three-ding chime when the workout is done.
- Pause, restart and skip controls, a progress bar and total time remaining.
- Keeps the screen awake while the timer runs (where the browser supports it).

Intervals are saved in the browser's `localStorage`, so they stay on the device you use.

## Running it

Open `index.html` in a browser, or serve the folder with any static file server and open it on your phone. It can be added to the home screen and runs full screen.

Notes:
- On iPhone, the ring/silent switch mutes browser audio. Turn silent mode off to hear the dings.
- Phone browsers pause timers when the screen locks or you switch apps. The timer catches up when you come back, but dings can't play while it's in the background.
