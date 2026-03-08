import { useCallback, useEffect, useRef, useState } from "react";

interface ComboboxProps {
  value: string;
  options: string[];
  placeholder?: string;
  onChange: (value: string) => void;
  className?: string;
}

export function Combobox({
  value,
  options,
  placeholder = "Select…",
  onChange,
  className = "",
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = query
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  // Reset state when opening/closing
  const openDropdown = useCallback(() => {
    setOpen(true);
    setQuery("");
    setActiveIndex(0);
  }, []);

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  // Focus input when dropdown opens
  useEffect(() => {
    if (open) {
      // Small delay to let the DOM render
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        closeDropdown();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, closeDropdown]);

  // Scroll active item into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const item = listRef.current.children[activeIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const handleSelect = useCallback(
    (val: string) => {
      onChange(val);
      closeDropdown();
    },
    [onChange, closeDropdown],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filtered[activeIndex]) handleSelect(filtered[activeIndex]);
          break;
        case "Escape":
          e.preventDefault();
          closeDropdown();
          break;
      }
    },
    [filtered, activeIndex, handleSelect, closeDropdown],
  );

  // Reset active index when filter changes
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => (open ? closeDropdown() : openDropdown())}
        className="flex h-7 w-full items-center justify-between gap-1 rounded border border-border bg-bg-1 px-2 text-[12px] text-text-secondary outline-none transition-colors hover:border-bg-5 focus:border-primary"
      >
        <span className={`truncate ${!value ? "text-text-placeholder" : ""}`}>
          {value || placeholder}
        </span>
        <svg
          width="8"
          height="8"
          viewBox="0 0 8 8"
          fill="none"
          className={`shrink-0 text-text-desc transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M1.5 3L4 5.5L6.5 3"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-[calc(100%+2px)] z-50 w-full min-w-[180px] rounded border border-border bg-bg-1 shadow-panel">
          {/* Search input */}
          <div className="border-b border-border p-1">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search…"
              className="h-6 w-full rounded-sm bg-bg-1-1 px-2 text-[12px] text-text-normal outline-none placeholder:text-text-placeholder"
            />
          </div>

          {/* Options list */}
          <div
            ref={listRef}
            className="max-h-[200px] overflow-y-auto py-0.5"
          >
            {filtered.length === 0 ? (
              <div className="px-2 py-1.5 text-[12px] text-text-placeholder">
                No matches
              </div>
            ) : (
              filtered.map((option, i) => (
                <button
                  key={option}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(option);
                  }}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`flex w-full items-center px-2 py-1 text-left text-[12px] transition-colors ${
                    i === activeIndex
                      ? "bg-bg-1-2 text-text-normal"
                      : "text-text-secondary"
                  } ${option === value ? "font-medium" : ""}`}
                >
                  <span className="truncate">{option}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
