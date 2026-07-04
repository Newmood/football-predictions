# football-predictions
Predict and discuss with your friends


1. FIFA Predictions
- Make your predictions about the upcoming rounds and see how you fair.

## Local development

This app is now scaffolded as a Next.js project so it can be hosted cleanly on Vercel.

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## What it does

- Seeds a knockout prediction board from the provided July 2026 bracket snapshot
- Lets users pick winners from the Round of 16 onward
- Auto-propagates winners into quarter-finals, semi-finals, final, and bronze-final
- Exports the finished board to a PNG in the browser

## Data source

The current bracket snapshot is served from `app/api/bracket/route.ts`.
If you want a live upstream feed later, that route is the only place you need to swap.
