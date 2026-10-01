import { Plugin, PluginSettingTab, Setting, type App, type WorkspaceLeaf } from "obsidian";
import { CanvasController, showResetNotice, type ControllerSettings } from "./controller";
import type { CanvasLike, CanvasViewLike } from "./types";

interface BendPointsSettings extends ControllerSettings {}

const DEFAULT_SETTINGS: BendPointsSettings = {
  bendRadius: 12,
  showHandles: "selected",
  handleSize: 7
};

export default class CanvasBendPointsPlugin extends Plugin {
  override settings: BendPointsSettings = { ...DEFAULT_SETTINGS };
  private readonly controllers = new Map<CanvasLike, CanvasController>();

  override async onload(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<BendPointsSettings> | null);
    this.addSettingTab(new BendPointsSettingTab(this.app, this));

    this.addCommand({
      id: "reset-selected-edges",
      name: "Restablecer puntos y posición del label en conexiones seleccionadas",
      checkCallback: (checking) => {
        const controller = this.getActiveController();
        if (!controller) return false;
        if (!checking) showResetNotice(controller.resetSelectedEdges());
        return true;
      }
    });

    this.registerEvent(this.app.workspace.on("layout-change", () => this.syncCanvases()));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.syncCanvases()));
    this.registerInterval(window.setInterval(() => this.syncCanvases(), 1500));
    this.app.workspace.onLayoutReady(() => this.syncCanvases());
  }

  override onunload(): void {
    for (const controller of this.controllers.values()) controller.destroy();
    this.controllers.clear();
  }

  async updateSettings(): Promise<void> {
    await this.saveData(this.settings);
    for (const controller of this.controllers.values()) controller.refreshSettings(this.settings);
  }

  private syncCanvases(): void {
    const live = new Set<CanvasLike>();
    this.app.workspace.iterateAllLeaves((leaf) => {
      const canvas = getCanvas(leaf);
      if (!canvas) return;
      live.add(canvas);
      if (!this.controllers.has(canvas)) this.controllers.set(canvas, new CanvasController(canvas, this.settings));
    });
    for (const [canvas, controller] of this.controllers.entries()) {
      if (live.has(canvas)) continue;
      controller.destroy();
      this.controllers.delete(canvas);
    }
  }

  private getActiveController(): CanvasController | null {
    const leaf = this.app.workspace.activeLeaf;
    if (!leaf) return null;
    const canvas = getCanvas(leaf);
    return canvas ? this.controllers.get(canvas) ?? null : null;
  }
}

function getCanvas(leaf: WorkspaceLeaf): CanvasLike | null {
  const view = leaf.view as unknown as CanvasViewLike;
  const isCanvas = view.getViewType?.() === "canvas" || view.file?.extension === "canvas";
  return isCanvas && view.canvas?.edges instanceof Map ? view.canvas : null;
}

class BendPointsSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: CanvasBendPointsPlugin) {
    super(app, plugin);
  }

  override display(): void {
    this.containerEl.empty();
    new Setting(this.containerEl)
      .setName("Mostrar puntos")
      .setDesc("Muestra los puntos siempre o sólo cuando la conexión está seleccionada.")
      .addDropdown((dropdown) => dropdown
        .addOption("selected", "Sólo en la conexión seleccionada")
        .addOption("always", "Siempre")
        .setValue(this.plugin.settings.showHandles)
        .onChange(async (value) => {
          this.plugin.settings.showHandles = value as BendPointsSettings["showHandles"];
          await this.plugin.updateSettings();
        }));

    new Setting(this.containerEl)
      .setName("Tamaño de los puntos")
      .setDesc("Radio visual y área de arrastre, en unidades del Canvas.")
      .addSlider((slider) => slider
        .setLimits(4, 14, 1)
        .setValue(this.plugin.settings.handleSize)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.handleSize = value;
          await this.plugin.updateSettings();
        }));

    new Setting(this.containerEl)
      .setName("Redondeo de esquinas")
      .setDesc("0 produce segmentos rectos; un valor mayor suaviza cada punto.")
      .addSlider((slider) => slider
        .setLimits(0, 40, 2)
        .setValue(this.plugin.settings.bendRadius)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.bendRadius = value;
          await this.plugin.updateSettings();
        }));
  }
}
