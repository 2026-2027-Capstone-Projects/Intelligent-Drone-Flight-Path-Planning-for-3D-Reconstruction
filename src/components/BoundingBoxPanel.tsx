import { useEffect, useState } from "react";
import {
  type BoundingBox,
  type BoundingBoxBuffer,
  BUFFER_STEP_M,
  ESTIMATED_FOOTPRINT_M,
  MAX_HORIZONTAL_BUFFER_M,
  validateBuffer,
  type Zone,
  type ZoneKind,
  type ZoneSpec,
} from "../boundingBox.ts";
import ZoneEditor from "./ZoneEditor.tsx";

type Props = {
  // Whether a building is selected. The building zone and the add buttons need one.
  buildingSelected: boolean;
  buffer: BoundingBoxBuffer;
  // Only called with a buffer that passed `validateBuffer`.
  onBufferChange: (buffer: BoundingBoxBuffer) => void;
  // The operating box around the selected building (the building zone).
  box: BoundingBox | null;
  // Notes or errors from generating the box (e.g. the altitude cap was applied).
  messages: string[];
  // User-added flight zones and no-flight zones.
  zones: Zone[];
  onAddZone: (kind: ZoneKind) => void;
  // Only called with a spec that `zoneFromSpec` accepts.
  onUpdateZone: (id: string, spec: ZoneSpec) => void;
  onRemoveZone: (id: string) => void;
  // Workable ground area in m² (see `workableGroundArea`).
  workableArea: number;
  // Warnings from `zoneWarnings`.
  zoneMessages: string[];
};

type BufferKey = keyof BoundingBoxBuffer;

// Input values are kept as strings so partial entries like "" or "1." aren't overwritten while typing.
type Draft = Record<BufferKey, string>;

const rows: { key: BufferKey; label: string }[] = [
  { key: "horizontal", label: "Horizontal buffer (m)" },
  { key: "vertical", label: "Vertical buffer (m)" },
];

const zoneSections: { kind: ZoneKind; heading: string; title: string; addLabel: string }[] = [
  {
    kind: "flight",
    heading: "Added flight zones",
    title: "Flight zone",
    addLabel: "+ Flight zone",
  },
  {
    kind: "noFlight",
    heading: "No-flight zones",
    title: "No-flight zone",
    addLabel: "+ No-flight zone",
  },
];

// An empty field becomes NaN, which validation reports as "must be a number".
const parse = (value: string) => (value.trim() === "" ? Number.NaN : Number(value));

export default function BoundingBoxPanel({
  buildingSelected,
  buffer,
  onBufferChange,
  box,
  messages,
  zones,
  onAddZone,
  onUpdateZone,
  onRemoveZone,
  workableArea,
  zoneMessages,
}: Props) {
  const [draft, setDraft] = useState<Draft>(() => ({
    horizontal: String(buffer.horizontal),
    vertical: String(buffer.vertical),
  }));
  const [errors, setErrors] = useState<string[]>([]);

  // Sync the inputs when the buffer changes from the −/+ buttons, but leave a field alone while
  // its text already parses to the current value (so typing "1." isn't reset to "1").
  useEffect(() => {
    setDraft((prev) => ({
      horizontal:
        parse(prev.horizontal) === buffer.horizontal ? prev.horizontal : String(buffer.horizontal),
      vertical: parse(prev.vertical) === buffer.vertical ? prev.vertical : String(buffer.vertical),
    }));
  }, [buffer]);

  const handleInput = (key: BufferKey, value: string) => {
    const nextDraft = { ...draft, [key]: value };
    setDraft(nextDraft);

    const candidate = {
      horizontal: parse(nextDraft.horizontal),
      vertical: parse(nextDraft.vertical),
    };
    const nextErrors = validateBuffer(candidate);
    setErrors(nextErrors);
    if (nextErrors.length > 0) {
      // Keep the last valid box on the globe until the input is fixed.
      console.warn("Invalid bounding box buffer; keeping the previous box.", nextErrors);
      return;
    }
    onBufferChange(candidate);
  };

  const step = (key: BufferKey, direction: 1 | -1) => {
    const max = key === "horizontal" ? MAX_HORIZONTAL_BUFFER_M : Number.POSITIVE_INFINITY;
    const value = Math.min(max, Math.max(0, buffer[key] + direction * BUFFER_STEP_M));
    const next = { ...buffer, [key]: value };
    // Overwrite both fields so a half-typed invalid value doesn't linger next to the new box.
    setDraft({ horizontal: String(next.horizontal), vertical: String(next.vertical) });
    setErrors([]);
    onBufferChange(next);
  };

  const size = ESTIMATED_FOOTPRINT_M + 2 * buffer.horizontal;

  return (
    <div className="absolute bottom-10 left-4 z-10 max-h-[60vh] w-80 overflow-y-auto rounded-lg bg-white/90 p-4 text-sm text-gray-900 shadow-lg">
      <h2 className="mb-2 font-semibold">Flight zones</h2>

      {buildingSelected && (
        <section>
          <h3 className="mb-1 flex items-center gap-1.5 font-medium">
            <span className="inline-block h-3 w-3 rounded-sm bg-lime-500" aria-hidden />
            Building zone
          </h3>
          <div className="space-y-2">
            {rows.map(({ key, label }) => (
              <div key={key} className="flex flex-col gap-0.5">
                <label htmlFor={`buffer-${key}`} className="text-gray-500">
                  {label}
                </label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => step(key, -1)}
                    className="w-8 rounded border border-gray-300 hover:bg-gray-100"
                    aria-label={`Decrease ${label} by ${BUFFER_STEP_M} m`}
                  >
                    −
                  </button>
                  <input
                    id={`buffer-${key}`}
                    type="number"
                    min={0}
                    step="any"
                    value={draft[key]}
                    onChange={(event) => handleInput(key, event.target.value)}
                    className="w-full min-w-0 rounded border border-gray-300 bg-white px-2 py-1"
                  />
                  <button
                    type="button"
                    onClick={() => step(key, 1)}
                    className="w-8 rounded border border-gray-300 hover:bg-gray-100"
                    aria-label={`Increase ${label} by ${BUFFER_STEP_M} m`}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          {box && (
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              <dt className="text-gray-500">Size</dt>
              <dd>
                {size.toFixed(0)} × {size.toFixed(0)} × {box.maxAltitude.toFixed(0)} m
              </dd>
              <dt className="text-gray-500">West</dt>
              <dd>{box.west.toFixed(6)}°</dd>
              <dt className="text-gray-500">East</dt>
              <dd>{box.east.toFixed(6)}°</dd>
              <dt className="text-gray-500">South</dt>
              <dd>{box.south.toFixed(6)}°</dd>
              <dt className="text-gray-500">North</dt>
              <dd>{box.north.toFixed(6)}°</dd>
            </dl>
          )}
        </section>
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

      <div className="mt-3 flex gap-2">
        {zoneSections.map(({ kind, addLabel }) => (
          <button
            key={kind}
            type="button"
            onClick={() => onAddZone(kind)}
            disabled={!buildingSelected}
            className="flex-1 rounded border border-gray-300 px-2 py-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {addLabel}
          </button>
        ))}
      </div>
      {!buildingSelected && (
        <p className="mt-1 text-xs text-gray-500">Select a building to add zones.</p>
      )}

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3">
        <dt className="text-gray-500">Workable ground area</dt>
        <dd>{Math.round(workableArea).toLocaleString()} m²</dd>
      </dl>

      <div role="status" aria-live="polite">
        {(errors.length > 0 || messages.length > 0 || zoneMessages.length > 0) && (
          <ul className="mt-2 list-none space-y-0.5">
            {errors.map((message) => (
              <li key={`error-${message}`} className="text-red-700">
                {message}
              </li>
            ))}
            {messages.map((message) => (
              <li key={`note-${message}`} className={box ? "text-amber-700" : "text-red-700"}>
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
