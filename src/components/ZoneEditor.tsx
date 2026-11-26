import { useMemo, useState } from "react";
import { type ZoneKind, type ZoneShape, type ZoneSpec, zoneFromSpec } from "../boundingBox.ts";

type Props = {
  title: string;
  kind: ZoneKind;
  spec: ZoneSpec;
  // Only called with a spec that `zoneFromSpec` accepts.
  onChange: (spec: ZoneSpec) => void;
  onRemove: () => void;
};

type ShapeKey = keyof ZoneShape;

// Input values are kept as strings so partial entries like "" or "1." aren't overwritten while typing.
type Draft = Record<ShapeKey, string>;

// Each row edits one value or a pair of related values side by side.
const rows: { label: string; fields: [ShapeKey, string][] }[] = [
  {
    label: "Offset from drawn center, east / north (m)",
    fields: [
      ["offsetEast", "East offset (m)"],
      ["offsetNorth", "North offset (m)"],
    ],
  },
  {
    label: "Width across / depth along the rotation (m)",
    fields: [
      ["width", "Width (m)"],
      ["depth", "Depth (m)"],
    ],
  },
  {
    label: "Rotation (° clockwise from north)",
    fields: [["heading", "Rotation (° clockwise from north)"]],
  },
  {
    label: "Altitude, min / max (m AGL)",
    fields: [
      ["minAltitude", "Min altitude (m AGL)"],
      ["maxAltitude", "Max altitude (m AGL)"],
    ],
  },
];

const shapeKeys: ShapeKey[] = rows.flatMap((row) => row.fields.map(([key]) => key));

// An empty field becomes NaN, which validation reports as "must be a number".
const parse = (value: string) => (value.trim() === "" ? Number.NaN : Number(value));

const swatchClass: Record<ZoneKind, string> = {
  flight: "bg-lime-500",
  noFlight: "bg-red-600",
};

/**
 * Edits one drawn flight zone or no-flight zone, in meters relative to the center of the
 * rectangle the user drew. Invalid input shows a message and leaves the last valid zone on the
 * globe.
 */
export default function ZoneEditor({ title, kind, spec, onChange, onRemove }: Props) {
  const [draft, setDraft] = useState<Draft>(
    () => Object.fromEntries(shapeKeys.map((key) => [key, String(spec[key])])) as Draft,
  );
  const [errors, setErrors] = useState<string[]>([]);
  const box = useMemo(() => zoneFromSpec(spec).box, [spec]);

  const handleInput = (key: ShapeKey, value: string) => {
    const nextDraft = { ...draft, [key]: value };
    setDraft(nextDraft);

    const candidate: ZoneSpec = { ...spec };
    for (const shapeKey of shapeKeys) candidate[shapeKey] = parse(nextDraft[shapeKey]);

    const result = zoneFromSpec(candidate);
    if (!result.box) {
      setErrors(result.messages);
      console.warn(`Invalid ${title}; keeping the previous zone.`, result.messages);
      return;
    }
    setErrors([]);
    onChange(candidate);
  };

  return (
    <div className="rounded border border-gray-200 p-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 font-medium">
          <span className={`inline-block h-3 w-3 rounded-sm ${swatchClass[kind]}`} aria-hidden />
          {title}
        </h4>
        <button
          type="button"
          onClick={onRemove}
          className="text-gray-500 hover:text-gray-900"
          aria-label={`Remove ${title}`}
        >
          ✕
        </button>
      </div>

      <div className="space-y-1">
        {rows.map(({ label, fields }) => (
          <div key={label} className="flex flex-col gap-0.5">
            <span className="text-xs text-gray-500">{label}</span>
            <div className="flex gap-1">
              {fields.map(([key, fieldLabel]) => (
                <input
                  key={key}
                  type="number"
                  step="any"
                  value={draft[key]}
                  onChange={(event) => handleInput(key, event.target.value)}
                  aria-label={`${title} ${fieldLabel}`}
                  className="w-full min-w-0 rounded border border-gray-300 bg-white px-2 py-0.5"
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {box && (
        <p className="mt-1 font-mono text-xs text-gray-500">
          Center {box.centerLatitude.toFixed(6)}°, {box.centerLongitude.toFixed(6)}°
          <br />
          Rotation {box.heading.toFixed(2)}°
        </p>
      )}

      <div role="status" aria-live="polite">
        {errors.length > 0 && (
          <ul className="mt-1 list-none space-y-0.5">
            {errors.map((message) => (
              <li key={message} className="text-red-700">
                {message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
