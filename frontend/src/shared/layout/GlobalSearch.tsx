import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { BriefcaseBusiness, Building2, LoaderCircle, Search, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { listApplications } from "@/features/applications/api";
import { listCompanies } from "@/features/companies/api";
import { listContacts } from "@/features/contacts/api";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { cn } from "@/shared/lib/utils";
import { Input } from "@/shared/ui/input";

type SearchResultType = "Application" | "Company" | "Contact";

interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  to: string;
}

const resultIcons = {
  Application: BriefcaseBusiness,
  Company: Building2,
  Contact: UserRound,
} satisfies Record<SearchResultType, typeof Search>;

export function GlobalSearch({ className }: { className?: string }) {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const debouncedQuery = useDebouncedValue(query.trim(), 300);

  const search = useQuery({
    queryKey: ["global-search", debouncedQuery],
    enabled: debouncedQuery.length >= 2,
    queryFn: async () => {
      const [applications, companies, contacts] = await Promise.all([
        listApplications({ search: debouncedQuery, page_size: 5 }),
        listCompanies({ search: debouncedQuery, page_size: 5 }),
        listContacts({ search: debouncedQuery, page_size: 5 }),
      ]);

      return [
        ...applications.items.map<SearchResult>((application) => ({
          id: `application-${application.id}`,
          type: "Application",
          title: application.vacancy.title,
          subtitle: application.vacancy.company?.name ?? "Application",
          to: `/applications/${application.id}`,
        })),
        ...companies.items.map<SearchResult>((company) => ({
          id: `company-${company.id}`,
          type: "Company",
          title: company.name,
          subtitle: company.industry ?? company.location ?? "Company",
          to: `/companies/${company.id}`,
        })),
        ...contacts.items.map<SearchResult>((contact) => ({
          id: `contact-${contact.id}`,
          type: "Contact",
          title: [contact.first_name, contact.last_name].filter(Boolean).join(" "),
          subtitle: contact.position ?? contact.company?.name ?? "Contact",
          to: `/contacts/${contact.id}`,
        })),
      ];
    },
  });

  const results = search.data ?? [];
  const groupedResults = useMemo(
    () =>
      (["Application", "Company", "Contact"] as const)
        .map((type) => ({ type, items: results.filter((item) => item.type === type) }))
        .filter((group) => group.items.length > 0),
    [results],
  );
  const trimmedQuery = query.trim();
  const showPopover = open && trimmedQuery.length >= 2;
  const isSearching =
    trimmedQuery.length >= 2 && (trimmedQuery !== debouncedQuery || search.isFetching);

  useEffect(() => {
    setActiveIndex(0);
  }, [debouncedQuery]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  function selectResult(result: SearchResult) {
    setOpen(false);
    setQuery("");
    navigate(result.to);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!showPopover || isSearching || results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      selectResult(results[activeIndex] ?? results[0]);
    }
  }

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-kumo-subtle"
      />
      <Input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search applications, companies, contacts..."
        className="h-11 w-full rounded-xl bg-kumo-base pl-10 pr-10 shadow-none"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showPopover}
        aria-controls="global-search-results"
        aria-activedescendant={
          showPopover && !isSearching && results[activeIndex]
            ? `search-option-${results[activeIndex].id}`
            : undefined
        }
      />
      {isSearching && (
        <LoaderCircle
          aria-label="Searching"
          className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-kumo-subtle"
        />
      )}

      {showPopover && (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-50 max-h-[min(28rem,70vh)] overflow-y-auto rounded-xl border border-kumo-hairline bg-kumo-overlay p-2 shadow-overlay"
        >
          {isSearching ? (
            <p className="flex items-center justify-center gap-2 px-3 py-5 text-sm text-kumo-subtle">
              <LoaderCircle className="size-4 animate-spin" />
              Searching…
            </p>
          ) : search.isError ? (
            <p className="px-3 py-5 text-center text-sm text-destructive">
              Search is unavailable right now.
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-5 text-center text-sm text-kumo-subtle">
              No matching applications, companies, or contacts.
            </p>
          ) : (
            groupedResults.map((group) => (
              <div key={group.type} className="mt-2 first:mt-0">
                <p className="px-3 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-kumo-subtle">
                  {group.type}s
                </p>
                {group.items.map((result) => {
                  const index = results.findIndex((item) => item.id === result.id);
                  const Icon = resultIcons[result.type];
                  return (
                    <button
                      id={`search-option-${result.id}`}
                      key={result.id}
                      type="button"
                      role="option"
                      aria-selected={index === activeIndex}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectResult(result)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                        index === activeIndex
                          ? "bg-primary-subtle text-kumo-strong"
                          : "hover:bg-kumo-tint",
                      )}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-kumo-tint text-kumo-subtle">
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{result.title}</span>
                        <span className="block truncate text-xs text-kumo-subtle">
                          {result.subtitle}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
