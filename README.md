# Canvas Bend Points

Add draggable bend points to Obsidian Canvas connections, preview the route while dragging, and reposition edge labels.

> Agrega puntos de control arrastrables a las conexiones de Obsidian Canvas, previsualiza la ruta durante el arrastre y cambia la posición de sus etiquetas. [Leer en español](#español).

## Features

- Double-click an edge to add one or more bend points.
- Drag a point with a live route preview.
- Double-click a point to remove it and recalculate the route.
- `Alt` + drag an edge label to reposition it.
- `Alt` + double-click a label to reset its position.
- Reset selected edges from the Command Palette.
- Configure handle visibility, size, and corner rounding.
- Store geometry inside the `.canvas` edge using forward-compatible custom properties.

## Installation

### Manual release installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest GitHub release.
2. Create `<your-vault>/.obsidian/plugins/canvas-bend-points/`.
3. Copy the three files into that folder.
4. Restart Obsidian.
5. Enable **Canvas Bend Points** under *Settings → Community plugins*.

### Build from source

```powershell
npm install
npm run build
npm test
```

Then copy `main.js`, `manifest.json`, and `styles.css` to the plugin folder shown above.

## Data format

The plugin stores `canvasBendPoints` and `canvasBendLabel` on individual edge objects. The official JSON Canvas types support arbitrary keys for forward compatibility, so other readers can safely ignore this metadata.

## Compatibility note

Obsidian does not currently expose a public API for changing the visual route of a Canvas edge. This plugin uses Canvas internals only for rendering and interaction, while persistence uses the extensible JSON Canvas format. A major Obsidian update may require an adaptation.

## Español

### Uso

1. Abre un archivo `.canvas` y crea una conexión entre dos tarjetas.
2. Haz **doble clic sobre la línea** para agregar un punto de control.
3. Arrastra el punto para cambiar el recorrido; verás una previsualización en vivo.
4. Haz **doble clic sobre el punto** para eliminarlo. La línea se recalcula con los puntos restantes.
5. Mantén `Alt` y arrastra el label para moverlo. En móvil, arrástralo directamente.
6. Usa `Alt` + doble clic sobre el label para restablecer su posición.

La paleta de comandos incluye **Canvas Bend Points: Restablecer puntos y posición del label...** para limpiar las conexiones seleccionadas.

### Instalación manual

Descarga `main.js`, `manifest.json` y `styles.css` de la release más reciente y cópialos en:

```text
<tu-vault>/.obsidian/plugins/canvas-bend-points/
```

Reinicia Obsidian y activa **Canvas Bend Points** en *Configuración → Complementos de la comunidad*.

## Development

Issues and pull requests are welcome. Please include your Obsidian version, operating system, and reproduction steps when reporting Canvas compatibility problems.

## License

[MIT](LICENSE)
