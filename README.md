# News Image — 23 November 2026

![Bounty](https://make.fun/badge/news-image-20261123.svg)
![Rank](https://make.fun/badge/news-image-20261123/herlienn/news-image-entry-23nov/rank.svg)
![Reward](https://make.fun/badge/news-image-20261123/herlienn/news-image-entry-23nov/reward.svg)

One image summing up Monday 23 November 2026's world news, drawn entirely in code.

**Bounty:** https://make.fun/bounty/news-image-20261123

## What it is

`main.ts` (Node 22, stdlib only, no network) draws a 1024×1024 newspaper front
page — "The World in One Day" — and writes it to `$MAKEFUN_OUTPUT_DIR/entry.png`
(or `/output/entry.png`). Everything is original: an own 5×7 bitmap font, an own
PNG encoder, and every scene drawn with rectangles, lines, circles and polygons.
No photos, no downloaded images.

## The day in the image — 43 stories, 6 continents

- **Heroes:** COP31 collapses in Antalya with no fossil-fuel deal; Iran strikes
  Bahrain as tankers burn in the Strait of Hormuz; Liverpool 4–0 Manchester
  United on Pochettino's nightmare debut.
- **The Day in Numbers:** 0 COP31 deal reached · $3.8bn GTA 6 day-one sales ·
  720/9 India's first innings · 11 killed in the Sinaloa raid · 43 UAP files
  released · 1,661 Gaza toll since the ceasefire.
- **Also inside:** a world map with 12 numbered pins, a "By the Clock — UTC"
  timeline, and an "Also on 23 Nov" list of 28 more stories.

## Date Check

News-cycle standard: stories first reported 22 Nov but headlining the 23 Nov
papers count as 23 Nov news. Sports scores verified against two sources.

## Run it

```sh
MAKEFUN_OUTPUT_DIR=./out node main.ts
```

Two runs produce byte-identical output.
