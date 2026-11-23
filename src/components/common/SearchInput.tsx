import { Search, X } from "lucide-react";
import { useRef } from "react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search",
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex h-8 shrink-0 items-center gap-2 rounded-control border border-hairline bg-elevated/60 px-2.5 transition-colors duration-150 ease-out-quart focus-within:border-hairline-strong">
      <Search
        size={13}
        strokeWidth={1.75}
        className="shrink-0 text-ink-muted"
      />
      <input
        ref={inputRef}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 bg-transparent text-xs text-ink outline-none placeholder:text-ink-muted"
      />
      {value !== "" && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          className="inline-flex size-4 cursor-pointer items-center justify-center rounded-full text-ink-muted transition-colors duration-150 ease-out-quart hover:bg-raised hover:text-ink"
        >
          <X size={11} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
