"use client";

import { Search, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";

type SearchBarProps = {
  placeholder?: string;
  defaultValue?: string;
  onSearch?: (value: string) => void;
  className?: string;
};

export function SearchBar({
  placeholder = "Search…",
  defaultValue = "",
  onSearch,
  className = "",
}: SearchBarProps) {
  // Make the input controlled so we can easily clear it
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync local state if the parent changes the defaultValue (e.g., clearing filters)
  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  // Handle real-time typing
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    onSearch?.(newValue); // Trigger search instantly as user types
  };

  // Quick clear functionality
  const handleClear = () => {
    setValue("");
    onSearch?.("");
    inputRef.current?.focus(); // Keep focus on input after clearing
  };

  // Prevent page reloads if user presses Enter
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSearch?.(value);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`flex h-10 w-full items-center gap-2 rounded-full border border-border bg-muted/30 px-3 shadow-sm transition-all focus-within:border-primary focus-within:bg-background focus-within:ring-1 focus-within:ring-primary/20 ${className}`}
    >
      <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      
      <input
        ref={inputRef}
        type="text" // Changed from "search" to remove the native browser 'x' so we can use our custom one
        name="query"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        aria-label="Search input"
        autoComplete="off"
      />
      
      {/* Modern 'Clear' button that only shows when there is text */}
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted-foreground/20 text-muted-foreground transition-colors hover:bg-muted-foreground/40 hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </form>
  );
}