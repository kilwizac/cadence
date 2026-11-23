# Cadence

A desktop app for mapping how the business runs. Each area of the business (Shipping & Receiving, Purchasing, Quality…) sits on an isometric floor plan as a building. Inside each area you build out its processes and steps, write or attach SOPs, and capture improvements, issues and things to come back to.

## Run it

```sh
bun install
bun run dev      # Vite + Electron with hot reload
bun run start    # production build, then launch
```

## Test, build, and release

Use Bun and Node.js 24. On macOS, install the Xcode command line tools to generate the icon or package the app.

```sh
bun run test         # run unit tests
bun run smoke        # build, exercise the app offscreen, and capture a screenshot
bun run build        # typecheck and build the renderer, main process, and preload
bun run package:mac  # build arm64 and x64 DMGs and ZIPs under release/
bun run icon:mac     # regenerate the committed PNG and ICNS under build/
```

The smoke test uses a temporary workspace and prints the screenshot's location. It doesn't open a visible window or touch your Cadence data.

Pushes to `main` run typecheck, unit tests, and build in GitHub Actions. To create downloadable packages, run the **Cadence CI** workflow manually from `main`, then download the **Cadence-macOS** artifact from that run.

Signing and notarization are optional. Set `CSC_LINK` and `CSC_KEY_PASSWORD` to use a Developer ID Application certificate. Also set `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID` to notarize the signed app. For GitHub Actions, set these as repository secrets; for a local release, set them in your environment. For a local build without a Developer ID signature, set `CSC_IDENTITY_AUTO_DISCOVERY=false`. macOS may block unsigned or unnotarized downloads, so sign and notarize builds intended for distribution.

## Using it

- **Add the first area** from the welcome card. Add more with **Add area**, pick its type, then click an open spot to place it. Drag a lot to move it, drag the ground to pan, scroll or pinch to zoom.
- **Explore the site model.** The map opens framed around your areas. Use **Show whole site** to see the coordinate grid, **Frame areas** to return, and the compass arrows to inspect the yards from four sides. **Map labels** toggles the callouts without hiding the buildings or routes.
- **⌘K** searches areas, processes, SOPs and open notes.
- **Processes** each add a piece of equipment to the area's lot, so busier areas fill in. Give each one a status (Not mapped → Mapped → Documented → Optimized), an owner, ordered steps and linked SOPs.
- **SOPs** are written in a rich-text editor (with a starter template) or attached by dropping files onto the SOPs tab. Attachments are copied into the app's library so the map keeps working if the original moves.
- **Notes** are tagged Improvement, Come back to, Issue or Question, optionally tied to a process. **Follow-ups** collects every open note across the map.
- **Flows** show what gets handed off. Follow the arrows between yards; selecting an area highlights its incoming and outgoing routes.

## Data

Everything is saved automatically to `~/Library/Application Support/Cadence/`: `workspace.json` plus an `attachments/` folder.

## 3D assets

The map is rendered with React Three Fiber using an orthographic isometric camera. Models live in `src/renderer/public/models/`, curated from Kenney's Factory Kit, City Kit Industrial, City Kit Commercial and Car Kit (CC0, see `LICENSE-kenney.txt`). `src/renderer/map/assets.ts` maps each area type to a main building and the props that appear as processes are added; swap a model by dropping a `.glb` into the matching folder and changing its id there.

## Layout

- `electron/` main process (file storage, dialogs) and preload bridge, bundled by `bun build`
- `src/renderer/` React UI built with Vite and Mantine; `map/MapScene.tsx` is the 3D map
- `src/shared/` types shared by both sides
