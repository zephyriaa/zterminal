import type { IPrimitivePaneRenderer, ISeriesPrimitive, SeriesAttachedParameter, Time } from "lightweight-charts";
import type { VolumeProfile } from "@/domain/analytics/market";

/** OHLCV estimates drawn in the existing price pane, using its native transform. */
export class VolumeProfilePrimitive implements ISeriesPrimitive<Time>, IPrimitivePaneRenderer {
  private attachedState: SeriesAttachedParameter<Time> | null = null;
  private profile: VolumeProfile | null = null;
  private tickSize = 0;
  attached(value: SeriesAttachedParameter<Time>) { this.attachedState = value; }
  detached() { this.attachedState = null; }
  paneViews() { return [{ zOrder: () => "top" as const, renderer: () => this }]; }
  setProfile(profile: VolumeProfile | null, tickSize: number) { this.profile = profile; this.tickSize = tickSize; this.attachedState?.requestUpdate(); }
  draw(target: Parameters<IPrimitivePaneRenderer["draw"]>[0]) {
    const profile = this.profile, series = this.attachedState?.series;
    if (!profile || !series) return;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      const { width, height } = mediaSize, maximum = Math.max(1, ...profile.levels.map(level => level.volume)), maxWidth = Math.min(120, width * .22);
      context.save(); context.beginPath(); context.rect(0, 0, width, height); context.clip();
      context.fillStyle = "rgba(63,169,201,0.3)";
      for (const level of profile.levels) {
        const y = series.priceToCoordinate(level.price), a = series.priceToCoordinate(level.price - this.tickSize / 2), b = series.priceToCoordinate(level.price + this.tickSize / 2);
        if (y == null || a == null || b == null || ![y, a, b].every(Number.isFinite) || level.volume <= 0) continue;
        const rowHeight = Math.max(1, Math.abs(b - a)), top = y - rowHeight / 2, barWidth = level.volume / maximum * maxWidth;
        if (top >= height || top + rowHeight <= 0) continue;
        context.fillRect(width - barWidth, top, barWidth, rowHeight);
      }
      const labels = [["POC", profile.pointOfControl], ["VAH", profile.valueAreaHigh], ["VAL", profile.valueAreaLow]] as const;
      let lastLabelY = -Infinity;
      const projected = labels.map(([name, price]) => ({ name, price, y: price == null ? null : series.priceToCoordinate(price) })).filter(item => item.y != null && Number.isFinite(item.y) && item.y >= 0 && item.y <= height).sort((a, b) => a.y! - b.y!);
      context.font = "10px monospace"; context.textAlign = "right"; context.textBaseline = "middle";
      for (const { name, price, y } of projected) {
        context.strokeStyle = name === "POC" ? "#e0a526" : "#3fa9c9"; context.lineWidth = 1;
        context.beginPath(); context.moveTo(width - maxWidth, y!); context.lineTo(width, y!); context.stroke();
        if (y! >= 6 && y! <= height - 6 && y! - lastLabelY >= 14) {
          context.fillStyle = name === "POC" ? "#e0a526" : "#3fa9c9";
          context.fillText(`${name} ${price}`, width - maxWidth - 4, y!); lastLabelY = y!;
        }
      }
      context.restore();
    });
  }
}
