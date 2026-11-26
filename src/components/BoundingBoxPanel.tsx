import type { Zone, ZoneKind, ZoneSpec } from "../boundingBox.ts";
import ZoneEditor from "./ZoneEditor.tsx";

type Props = {
  // Flight zones and no-flight zones drawn by the user.
  zones: Zone[];
  // The kind of zone being drawn, or null when draw mode is off.
  drawingKind: ZoneKind | null;
  onStartDrawing: (kind: ZoneKind) => void;
  onCancelDrawing: () => void;
  // Why the last drawing attempt didn't create a zone.
  drawMessages: string[];
  // Only called with a spec that `zoneFromSpec` accepts.
  onUpdateZone: (id: string, spec: ZoneSpec) => void;
  onRemoveZone: (id: string) => void;
  // Workable ground area in m² (see `workableGroundArea`).
  workableArea: number;
  // Warnings from `zoneWarnings`.
  zoneMessages: string[];
};

const zoneSections: { kind: ZoneKind; heading: string; title: string; drawLabel: string }[] = [
  {
    kind: "flight",
    heading: "Flight zones",
    title: "Flight zone",
    drawLabel: "Draw flight zone",
  },
  {
    kind: "noFlight",
    heading: "No-flight zones",
    title: "No-flight zone",
    drawLabel: "Draw no-flight zone",
  },
];

const swatchClass: Record<ZoneKind, string> = {
  flight: "bg-lime-500",
  noFlight: "bg-red-600",
};

export default function BoundingBoxPanel({
  zones,
  drawingKind,
  onStartDrawing,
  onCancelDrawing,
  drawMessages,
  onUpdateZone,
  onRemoveZone,
  workableArea,
  zoneMessages,
}: Props) {
  const drawingTitle = zoneSections.find(({ kind }) => kind === drawingKind)?.title;

  return (
    <div className="absolute bottom-10 left-4 z-10 max-h-[60vh] w-80 overflow-y-auto rounded-lg bg-white/90 p-4 text-sm text-gray-900 shadow-lg">
      <h2 className="mb-2 font-semibold">Flight zones</h2>

      <div className="flex gap-2">
        {zoneSections.map(({ kind, drawLabel }) => (
          <button
            key={kind}
            type="button"
            onClick={() => onStartDrawing(kind)}
            disabled={drawingKind !== null}
            aria-pressed={drawingKind === kind}
            className="flex flex-1 items-center justify-center gap-1.5 rounded border border-gray-300 px-2 py-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className={`inline-block h-3 w-3 rounded-sm ${swatchClass[kind]}`} aria-hidden />
            {drawLabel}
          </button>
        ))}
      </div>

      {drawingKind ? (
        <div className="mt-2 flex items-start justify-between gap-2 rounded bg-sky-50 p-2 text-sky-900">
          <p>
            Drawing a {drawingTitle?.toLowerCase()}: drag on the ground from one corner to the
            opposite corner. Press Esc to cancel.
          </p>
          <button
            type="button"
            onClick={() => onCancelDrawing()}
            className="rounded border border-sky-300 px-2 py-0.5 hover:bg-sky-100"
          >
            Cancel
          </button>
        </div>
      ) : (
        zones.length === 0 && (
          <p className="mt-1 text-xs text-gray-500">
            Draw a flight zone to set where the drone may fly.
          </p>
        )
      )}

      {zoneSections.map(({ kind, heading, title }) => {
        const ofKind = zones.filter((zone) => zone.kind === kind);
        if (ofKind.length === 0) return null;
        return (
          <section key={kind} className="mt-3">
            <h3 className="mb-1 font-medium">{heading}</h3>
            <div className="space-y-2">
              {ofKind.map((zone, index) => (
                <ZoneEditor
                  key={zone.id}
                  title={`${title} ${index + 1}`}
                  kind={kind}
                  spec={zone.spec}
                  onChange={(spec) => onUpdateZone(zone.id, spec)}
                  onRemove={() => onRemoveZone(zone.id)}
                />
              ))}
            </div>
          </section>
        );
      })}

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3">
        <dt className="text-gray-500">Workable ground area</dt>
        <dd>{Math.round(workableArea).toLocaleString()} m²</dd>
      </dl>

      <div role="status" aria-live="polite">
        {(drawMessages.length > 0 || zoneMessages.length > 0) && (
          <ul className="mt-2 list-none space-y-0.5">
            {drawMessages.map((message) => (
              <li key={`draw-${message}`} className="text-red-700">
                {message}
              </li>
            ))}
            {zoneMessages.map((message) => (
              <li key={`zone-${message}`} className="text-amber-700">
                {message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
