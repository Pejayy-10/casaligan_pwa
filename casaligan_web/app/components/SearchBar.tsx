"use client";

import { Search } from "lucide-react";

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
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const value = (formData.get("query") as string) ?? "";
    onSearch?.(value);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`flex items-center gap-3 rounded-full border border-border bg-muted/80 px-4 py-2 shadow-sm transition focus-within:border-primary focus-within:shadow ${className}`}
    >
      <Search className="h-5 w-5 text-muted-foreground" aria-hidden />
      <input
        type="search"
        name="query"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        aria-label="Search"
      />
      <button
        type="submit"
        className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
      >
        Search
      </button>
    </form>
  );
}


