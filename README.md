# Cadence

A desktop app for mapping how the business runs. Each area of the business (Shipping & Receiving, Purchasing, Quality…) sits on an isometric floor plan as a building. Inside each area you build out its processes and steps, write or attach SOPs, and capture improvements, issues and things to come back to.

## Run it

```sh
bun install
bun run dev      # Vite + Electron with hot reload
bun run start    # production build, then launch
```

## Using it

- **Add the first area** from the welcome card. Add more with **Add area**, pick its type, then click an open spot to place it. Drag a lot to move it, drag the ground to pan, scroll or pinch to zoom.
- **⌘K** searches areas, processes, SOPs and open notes.
- **Processes** each add a piece of equipment to the area's lot, so busier areas fill in. Give each one a status (Not mapped → Mapped → Documented → Optimized), an owner, ordered steps and linked SOPs.
- **SOPs** are written in a rich-text editor (with a starter template) or attached by dropping files onto the SOPs tab. Attachments are copied into the app's library so the map keeps working if the original moves.
- **Notes** are tagged Improvement, Come back to, Issue or Question, optionally tied to a process. **Follow-ups** collects every open note across the map.
- **Flows** connect areas to show what gets handed off.

## Data

Everything is saved automatically to `~/Library/Application Support/Cadence/`: `workspace.json` plus an `attachments/` folder.

## 3D assets

The map is rendered with React Three Fiber using an orthographic isometric camera. Models live in `src/renderer/public/models/`, curated from Kenney's Factory Kit, City Kit Industrial, City Kit Commercial and Car Kit (CC0, see `LICENSE-kenney.txt`). `src/renderer/map/assets.ts` maps each area type to a main building and the props that appear as processes are added; swap a model by dropping a `.glb` into the matching folder and changing its id there.

## Layout

- `electron/` main process (file storage, dialogs) and preload bridge, bundled by `bun build`
- `src/renderer/` React UI built with Vite and Mantine; `map/MapScene.tsx` is the 3D map
- `src/shared/` types shared by both sides
