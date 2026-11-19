import { useEffect, useState } from "react";
import {
  type BoundingBox,
  type BoundingBoxBuffer,
  BUFFER_STEP_M,
  ESTIMATED_FOOTPRINT_M,
  MAX_HORIZONTAL_BUFFER_M,
  validateBuffer,
} from "../boundingBox.ts";

type Props = {
  buffer: BoundingBoxBuffer;
  onBufferChange: (buffer: BoundingBoxBuffer) => void;
  box: BoundingBox | null;
  messages: string[];
};

type BufferKey = keyof BoundingBoxBuffer;
type Draft = Record<BufferKey, string>;

const rows: { key: BufferKey; label: string }[] = [
  { key: "horizontal", label: "Horizontal buffer (m)" },
  { key: "vertical", label: "Vertical buffer (m)" },
];

const parse = (value: string) => (value.trim() === "" ? Number.NaN : Number(value));

export default function BoundingBoxPanel({ buffer, onBufferChange, box, messages }: Props) {
  const [draft, setDraft] = useState<Draft>(() => ({
    horizontal: String(buffer.horizontal),
    vertical: String(buffer.vertical),
  }));
  const [errors, setErrors] = useState<string[]>([]);

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
    if (nextErrors.length > 0) return;
    onBufferChange(candidate);
  };

  const step = (key: BufferKey, direction: 1 | -1) => {
    const max = key === "horizontal" ? MAX_HORIZONTAL_BUFFER_M : Number.POSITIVE_INFINITY;
    const value = Math.min(max, Math.max(0, buffer[key] + direction * BUFFER_STEP_M));
    const next = { ...buffer, [key]: value };
    setDraft({ horizontal: String(next.horizontal), vertical: String(next.vertical) });
    setErrors([]);
    onBufferChange(next);
  };

  const size = ESTIMATED_FOOTPRINT_M + 2 * buffer.horizontal;

  return (
    <div className="absolute bottom-10 left-4 z-10 w-72 rounded-lg bg-white/95 p-4 text-sm text-gray-900 shadow-lg backdrop-blur-sm">
      <h2 className="mb-2 font-semibold">Drone Operating Volume</h2>

      <div className="space-y-2">
        {rows.map(({ key, label }) => (
          <div key={key} className="flex flex-col gap-0.5">
            <label htmlFor={`buffer-${key}`} className="text-xs text-gray-500">
              {label}
            </label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => step(key, -1)}
                className="w-8 rounded border border-gray-300 hover:bg-gray-100"
                aria-label={`Decrease ${label}`}
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
                aria-label={`Increase ${label}`}
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      {box && (
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
          <dt className="text-gray-500">Size</dt>
          <dd>
            {size.toFixed(0)} × {size.toFixed(0)} × {box.maxAltitude.toFixed(0)} m
          </dd>
          <dt className="text-gray-500">Bounds</dt>
          <dd>
            {box.west.toFixed(4)}°, {box.south.toFixed(4)}° to {box.east.toFixed(4)}°, {box.north.toFixed(4)}°
          </dd>
        </dl>
      )}

      <div role="status" aria-live="polite">
        {(errors.length > 0 || messages.length > 0) && (
          <ul className="mt-2 list-none space-y-0.5 text-xs">
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
          </ul>
        )}
      </div>
    </div>
  );
}
