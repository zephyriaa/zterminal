export type ContextUtilityState = "UNAVAILABLE";

type ContextUtility = {
  id: "fear-greed" | "cot";
  label: string;
  state: ContextUtilityState;
  detail: string;
};

const SOURCE_GATED_UTILITIES: ContextUtility[] = [
  { id: "fear-greed", label: "Fear & Greed", state: "UNAVAILABLE", detail: "Source integration required" },
  { id: "cot", label: "Simplified COT", state: "UNAVAILABLE", detail: "Source integration required" },
];

/**
 * Context utilities deliberately carry no market values until a labelled provider,
 * timestamp, cadence, and classification contract have been approved.
 */
export function ContextUtilityRail() {
  return (
    <aside className="context-utility-rail" aria-label="Source-gated market context utilities">
      {SOURCE_GATED_UTILITIES.map((utility) => (
        <div className="context-utility" key={utility.id} title={`${utility.label}: ${utility.detail}`}>
          <span>{utility.label}</span>
          <b>{utility.state}</b>
          <small>{utility.detail}</small>
        </div>
      ))}
    </aside>
  );
}
