import type { Coordinate, IPrimitivePaneRenderer, IPrimitivePaneView, ISeriesPrimitive, PrimitiveHoveredItem, SeriesAttachedParameter, Time } from "lightweight-charts";
import type { BigTradesOverlaySettings } from "./contracts";
import type { BigTradeCluster } from "./big-trades";

type ProjectedCluster = BigTradeCluster & { x: Coordinate; y: Coordinate; radius: number; color: string; opacity: number };

class BigTradesRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly read: () => ProjectedCluster[]) {}

  draw(target: Parameters<IPrimitivePaneRenderer["draw"]>[0]) {
    target.useMediaCoordinateSpace(({ context }) => {
      for (const cluster of this.read()) {
        context.save();
        context.globalAlpha = cluster.opacity;
        context.fillStyle = cluster.color;
        context.beginPath();
        context.arc(cluster.x, cluster.y, cluster.radius, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = 0.88;
        context.lineWidth = 1;
        context.strokeStyle = cluster.color;
        context.stroke();
        context.restore();
      }
    });
  }
}

class BigTradesView implements IPrimitivePaneView {
  private readonly output: BigTradesRenderer;
  constructor(read: () => ProjectedCluster[]) { this.output = new BigTradesRenderer(read); }
  zOrder() { return "top" as const; }
  renderer() { return this.output; }
}

/**
 * A Lightweight Charts primitive rather than DOM bubbles. The primitive stores
 * only a capped visible set and performs projection when the chart requests it.
 */
export class BigTradesPrimitive implements ISeriesPrimitive<Time> {
  private attachedState: SeriesAttachedParameter<Time> | null = null;
  private clusters: BigTradeCluster[] = [];
  private projected: ProjectedCluster[] = [];
  private settings: BigTradesOverlaySettings | null = null;
  private hoveredId: string | null = null;
  private readonly view = new BigTradesView(() => this.projected);

  constructor(private readonly onHover?: (cluster: BigTradeCluster | null) => void) {}

  attached(param: SeriesAttachedParameter<Time>) { this.attachedState = param; this.updateAllViews(); }
  detached() { this.attachedState = null; this.projected = []; this.publishHover(null); }
  paneViews() { return [this.view]; }

  setClusters(clusters: readonly BigTradeCluster[], settings: BigTradesOverlaySettings | null) {
    this.clusters = settings ? [...clusters].slice(-settings.maxVisible) : [];
    this.settings = settings;
    this.updateAllViews();
    if (!settings || (this.hoveredId && !this.projected.some(cluster => cluster.id === this.hoveredId))) this.publishHover(null);
    this.attachedState?.requestUpdate();
  }

  updateAllViews() {
    if (!this.attachedState || !this.settings) { this.projected = []; return; }
    const { chart, series } = this.attachedState;
    const scale = this.settings.bubbleScale;
    const max = Math.max(1, ...this.clusters.map(cluster => scale === "quantity" ? cluster.quantity : cluster.notional));
    const opacity = this.settings.opacity;
    this.projected = this.clusters.map(cluster => {
      const x = chart.timeScale().timeToCoordinate((cluster.timestamp / 1000) as Time);
      const y = series.priceToCoordinate(cluster.price);
      if (x == null || y == null) return null;
      const amount = scale === "quantity" ? cluster.quantity : cluster.notional;
      return {
        ...cluster,
        x,
        y,
        radius: Math.max(4, Math.min(22, 4 + 18 * Math.sqrt(Math.max(0, amount) / max))),
        color: cluster.side === "buy" ? this.settings!.buyColor : this.settings!.sellColor,
        opacity,
      };
    }).filter((cluster): cluster is ProjectedCluster => cluster !== null);
  }

  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    const match = [...this.projected].reverse().find(cluster => (cluster.x - x) ** 2 + (cluster.y - y) ** 2 <= (cluster.radius + 3) ** 2);
    this.publishHover(match ?? null);
    return match ? { externalId: match.id, zOrder: "top", cursorStyle: "pointer", hitTestPriority: 2, itemType: "primitive" } : null;
  }

  private publishHover(cluster: BigTradeCluster | null) {
    const id = cluster?.id ?? null;
    if (id === this.hoveredId) return;
    this.hoveredId = id;
    this.onHover?.(cluster);
  }
}
