import { useId } from "react";

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  display: string;
  onChange: (v: number) => void;
}
export default function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  display,
  onChange,
}: SliderProps) {
  const id = useId();
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label htmlFor={id} className="text-sm text-aph-dark-blue font-medium">
          {label}
        </label>
        <span className="text-aph-dark-blue font-bold text-base tabular-nums">
          {display}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-aph-blue"
      />
    </div>
  );
}
