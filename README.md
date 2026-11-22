# Lixy Studios

A local-first visual web editor built with React, TypeScript, Vite, Monaco Editor, JSZip, and Electron.

## Development

```powershell
npm install
npm run dev
```

Run the desktop shell with Vite:

```powershell
npm run electron
```

## Production build

```powershell
npm run build
npm run dist
```

The Windows installer is generated in `release/`.

## Included capabilities

- Home dashboard with a light/dark theme, a real local project summary, searchable pages and elements, responsive navigation, and working editor, generated-code, icon library, preview, resource, and export actions
- Desktop-style studio workspace with project, edit, view, design, run, window, and help menus; a vertical tool rail; Pages/Layers, Components, Assets, and Icons panels; and categorized Design/Styles/Advanced inspector tabs
- Resizable side panels and an optional collapsed development dock with generated HTML/CSS/JavaScript and export diagnostics; the live website preview has a dedicated full-size workspace
- Monaco displays the generated export files read-only; editing source code and synchronizing it back into the visual project are not implemented yet
- Icon library with searchable categories, locally saved favorites, click or drag-to-canvas insertion, editable color and stroke width, and inline SVG export
- Components panel clearly marks its reusable component library as pending; Assets lists the images and fonts used on the active page
- Drag, resize with eight handles, and rotate canvas elements directly
- Multi-select layers with Shift-click or canvas marquee; move, duplicate, delete, align, distribute, group, and ungroup selections
- Ctrl+G groups the current selection; Ctrl+Shift+G ungroups the selected group
- Smart alignment guides and optional grid snapping while moving layers
- Eight-point selection controls, rotation, responsive panel sizing, and adjustable grid
- Text, button, input, frame, card, image, SVG icon, circle, rectangle, and line elements
- Persistent canvas placement tools: click or drag to add multiple items; F/T/B/I/O/R/L select Frame, Text, Button, Image, Circle, Rectangle, and Line tools, and Esc returns to selection
- Nested frames with phone, tablet, and desktop presets, independent layers, and prototype starting points
- Auto Layout for frames and groups with horizontal or vertical flow, adjustable gap, padding, alignment, child reordering, and restored base sizes when stretch layout is disabled
- Typography controls for installed font families, custom fonts, weights, spacing, alignment, decoration, case, and opacity
- Image import by file picker, canvas drag-and-drop, and clipboard paste; image fills and clips to selected circles or rectangles, with fit, crop position, and replacement controls
- Clean transparent editor workspace without a default checker grid; Frames provide the visible screen surface
- Page management with double-click rename, duplicate-name validation, and confirmed deletion
- Independent canvases for each page, with in-preview page navigation and button links between frames on the same page
- Ctrl+C / Ctrl+V layer copy and paste, including complete frames and their nested contents
- iPhone, Samsung Galaxy, and Google Pixel previews with a 402 × 874 design viewport that scales to fit the available screen height
- Configurable outer and inset shadows, including blur, angle, distance, and color
- Page management and hierarchical frame/layer organization
- Categorized transform, layout, typography, appearance, spacing, effects, and advanced inspector
- Desktop, tablet, and phone canvas sizes
- Responsive tool and inspector panels for smaller screens
- Grid and zoom controls
- Live previews for the editor canvas and generated website, with responsive scaling to the available panel size
- Automatic local saving with IndexedDB support for larger projects and localStorage compatibility
- Validated multi-page ZIP export containing linked HTML pages, separate `styles.css` and `script.js`, editable and backward-compatible `project.json`, documentation, imported image assets, and custom fonts; external image URLs are kept as links
- Exported top-level Frames run as responsive app screens, with working same-page and cross-page navigation
- Live preview runs the generated website in an isolated iframe, so exported interactions and layout are what the user previews
- Export validation detects broken page/frame links, missing containers, hierarchy cycles, unsupported assets, and invalid geometry before download

## Current scope

Lixy Studios creates functional web pages and applications rather than interactive prototypes. The generated website can be previewed and exported as HTML, CSS, and JavaScript. The dashboard currently represents one locally stored project; separate project creation, opening project files, and templates are not yet available. Some advanced editor capabilities, including reusable component libraries and bidirectional code editing, remain future work and are not represented as available features in the workspace.
