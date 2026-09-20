# MzansiToken - frontend

React 19 + Vite. Three pages against the FastAPI backend: Inspect, Compare
and Rank. The project README, one level up, explains what any of it means.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build
npm run lint
npm run test:run
```

The backend is expected at `http://127.0.0.1:8000`. Point it elsewhere with
`VITE_API_BASE_URL` in a `.env` file.

## How it is arranged

```
src/
  main.jsx              mounts the app, loads the four shared style layers
  App.jsx               shell, routing, the flag backdrop
  pages/                Home, Inspect, Compare, Rank - each with its own CSS
  components/           shared UI: StatusLine, MetricCards, CorpusUpload, ...
  lib/                  pure helpers, no JSX - safe to import anywhere
  api/client.jsx        every call to the backend, and the error wording
  styles/               tokens -> base -> layout -> components
```

Two rules keep it from tangling. **A file exports either a component or
plain functions, never both** - React fast refresh silently stops working on
a file that does both, which is why the helpers live in `lib/`. And **a
style belongs to the narrowest layer that needs it**: a rule used by one
page goes in that page's CSS, a rule used by two goes in `components.css`.

`main.jsx` imports the four shared layers in cascade order and each page
imports its own file, so nothing but `tokens.css` is ever loaded twice.
