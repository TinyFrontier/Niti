import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs } from "@cloudflare/kumo/components/tabs";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { differenceInCalendarDays, format } from "date-fns";
import {
  Archive,
  ArchiveRestore,
  Briefcase,
  AlertTriangle,
  ExternalLink,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import {
  archiveVacancy,
  deleteVacancy,
  getVacancyStats,
  listVacancies,
  unarchiveVacancy,
  VACANCY_STATUSES,
  WORK_FORMATS,
  type Vacancy,
  type VacancySort,
  type VacancyStatus,
  type VacancyTab,
  type WorkFormat,
} from "@/features/vacancies/api";
import {
  getMatchSummaries,
  type MatchSummary,
  type MatchVerdict,
} from "@/features/job-match/api";
import { VerdictBadge } from "@/features/job-match/VerdictBadge";
import { PasteLinkCard } from "@/features/vacancies/PasteLinkCard";
import { VacancyStatusBadge } from "@/features/vacancies/VacancyStatusBadge";
import { DataTable, type Column } from "@/shared/data-table/DataTable";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { PageHeader } from "@/shared/layout/PageHeader";
import { humanize } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/empty-state";
import { EntityAvatar } from "@/shared/ui/entity-avatar";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";

const TABS: Array<{ value: VacancyTab; label: string }> = [
  { value: "all", label: "All" },
  { value: "saved", label: "Saved" },
  { value: "applied", label: "Applied" },
  { value: "archived", label: "Archived" },
];

const SORT_OPTIONS: Array<{ value: VacancySort; label: string }> = [
  { value: "newest", label: "Date added" },
  { value: "oldest", label: "Oldest first" },
  { value: "title", label: "Role A–Z" },
  { value: "company", label: "Company A–Z" },
  { value: "fit", label: "Best fit" },
];

const VERDICT_OPTIONS: Array<{ value: MatchVerdict; label: string }> = [
  { value: "apply", label: "Apply" },
  { value: "maybe", label: "Maybe" },
  { value: "skip", label: "Skip" },
];

function addedLabel(value: string): string {
  const date = new Date(value);
  const days = differenceInCalendarDays(new Date(), date);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (date.getFullYear() === new Date().getFullYear()) return format(date, "MMM d");
  return format(date, "MMM d, yyyy");
}

/** "Remote · Europe" when both are known, without repeating the format twice. */
function locationLabel(vacancy: Vacancy): string {
  const workFormat = vacancy.work_format === "unknown" ? null : humanize(vacancy.work_format);
  const { location } = vacancy;
  if (!workFormat) return location ?? "—";
  if (!location) return workFormat;
  if (location.toLowerCase().includes(workFormat.toLowerCase())) return location;
  return `${workFormat} · ${location}`;
}

/** Kumo's menu items default to 16px with roomy padding — too heavy for a table row. */
const MENU_ITEM = "gap-2 px-2.5 py-1.5 text-sm [&_svg]:size-4";

function RowActions({ vacancy }: { vacancy: Vacancy }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["vacancies"] });

  const archiveMutation = useMutation({
    mutationFn: () =>
      vacancy.archived_at ? unarchiveVacancy(vacancy.id) : archiveVacancy(vacancy.id),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteVacancy(vacancy.id),
    onSuccess: invalidate,
  });

  return (
    // the row itself navigates, so keep menu clicks from bubbling into it
    <div onClick={(event) => event.stopPropagation()} className="flex justify-end">
      <DropdownMenu>
        <DropdownMenu.Trigger>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${vacancy.title}`}
            className="text-kumo-subtle"
          >
            <MoreVertical />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end" className="min-w-52 p-1">
          <DropdownMenu.Item
            className={MENU_ITEM}
            icon={<Pencil />}
            onClick={() => navigate(`/vacancies/${vacancy.id}/edit`)}
          >
            Edit vacancy
          </DropdownMenu.Item>
          {vacancy.url && (
            <DropdownMenu.Item
              className={MENU_ITEM}
              icon={<ExternalLink />}
              onClick={() => window.open(vacancy.url!, "_blank", "noopener,noreferrer")}
            >
              Open original posting
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Separator />
          <DropdownMenu.Item
            className={MENU_ITEM}
            icon={vacancy.archived_at ? <ArchiveRestore /> : <Archive />}
            disabled={archiveMutation.isPending}
            onClick={() => archiveMutation.mutate()}
          >
            {vacancy.archived_at ? "Unarchive" : "Archive"}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={MENU_ITEM}
            icon={<Trash2 />}
            variant="danger"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (window.confirm(`Delete "${vacancy.title}"? This cannot be undone.`)) {
                deleteMutation.mutate();
              }
            }}
          >
            Delete
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>
    </div>
  );
}

/** Badge for the list: the verdict if there is one, quiet otherwise. */
function FitCell({ fit }: { fit: MatchSummary | undefined }) {
  if (!fit) return <span className="text-muted-foreground">—</span>;
  if (fit.status === "processing") {
    return <Loader2 className="size-3.5 animate-spin text-muted-foreground" />;
  }
  if (fit.status === "failed" || !fit.verdict) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className="inline-flex items-center gap-1">
      <VerdictBadge verdict={fit.verdict} score={fit.score} className="-ml-2" />
      {fit.is_stale && (
        <span title="The vacancy, CV or profile changed after this analysis">
          <AlertTriangle className="size-3 text-amber-500" />
        </span>
      )}
    </span>
  );
}

const buildColumns = (fits: Map<string, MatchSummary>): Column<Vacancy>[] => [
  {
    key: "role",
    header: "Role",
    render: (vacancy) => (
      <div className="flex items-center gap-3">
        <EntityAvatar name={vacancy.company?.name ?? vacancy.title} />
        <div className="min-w-0">
          <p className="truncate font-medium text-kumo-strong">{vacancy.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {vacancy.company?.name ?? "No company"}
          </p>
        </div>
      </div>
    ),
  },
  {
    key: "status",
    header: "Status",
    // pulled left by the pill's own padding so the label lines up with the header
    render: (vacancy) => <VacancyStatusBadge status={vacancy.status} className="-ml-2" />,
  },
  {
    key: "fit",
    header: "Fit",
    className: "w-28",
    render: (vacancy) => <FitCell fit={fits.get(vacancy.id)} />,
  },
  {
    key: "location",
    header: "Location",
    render: (vacancy) => <span className="text-kumo-default">{locationLabel(vacancy)}</span>,
  },
  {
    key: "salary",
    header: "Salary",
    render: (vacancy) =>
      vacancy.salary ?? <span className="text-muted-foreground">Not listed</span>,
  },
  {
    key: "added",
    header: "Added",
    render: (vacancy) => (
      <span className="text-muted-foreground">{addedLabel(vacancy.created_at)}</span>
    ),
  },
  {
    key: "actions",
    header: "",
    className: "w-14",
    render: (vacancy) => <RowActions vacancy={vacancy} />,
  },
];

export function VacanciesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<VacancyTab>("all");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<VacancyStatus | "">("");
  const [workFormat, setWorkFormat] = useState<WorkFormat | "">("");
  const [verdict, setVerdict] = useState<MatchVerdict | "">("");
  const [sort, setSort] = useState<VacancySort>("newest");
  const debouncedSearch = useDebouncedValue(search);

  // counters ignore the tab but follow every other filter
  const statsParams = {
    search: debouncedSearch || undefined,
    work_format: workFormat || undefined,
    verdict: verdict || undefined,
  };
  const listParams = {
    ...statsParams,
    page,
    tab,
    status: status || undefined,
    sort,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["vacancies", listParams],
    queryFn: () => listVacancies(listParams),
  });
  const { data: stats } = useQuery({
    queryKey: ["vacancies", "stats", statsParams],
    queryFn: () => getVacancyStats(statsParams),
  });

  const pageIds = (data?.items ?? []).map((vacancy) => vacancy.id);
  const { data: fits } = useQuery({
    queryKey: ["match-summaries", pageIds],
    queryFn: () => getMatchSummaries(pageIds),
    enabled: pageIds.length > 0,
    // an analysis queued by the importer finishes while the user is on this page
    refetchInterval: (query) =>
      query.state.data?.some((fit) => fit.status === "processing") ? 4000 : false,
    refetchIntervalInBackground: true,
  });
  const columns = useMemo(
    () => buildColumns(new Map((fits ?? []).map((fit) => [fit.vacancy_id, fit]))),
    [fits],
  );

  const resetPage = <T,>(apply: (value: T) => void) => (value: T) => {
    apply(value);
    setPage(1);
  };
  const filtersActive = Boolean(search || status || workFormat || verdict) || sort !== "newest";
  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setWorkFormat("");
    setVerdict("");
    setSort("newest");
    setPage(1);
  };

  const toolbar = (
    <div>
      <div className="border-b border-border px-4 pt-1">
        <Tabs
          variant="underline"
          value={tab}
          onValueChange={resetPage((value: string) => setTab(value as VacancyTab))}
          tabs={TABS.map(({ value, label }) => ({
            value,
            label: (
              <span className="flex items-center gap-2">
                {label}
                {stats && (
                  <span className="text-xs tabular-nums text-muted-foreground">{stats[value]}</span>
                )}
              </span>
            ),
          }))}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-kumo-subtle"
          />
          <Input
            placeholder="Search vacancies..."
            value={search}
            onChange={(event) => resetPage(setSearch)(event.target.value)}
            className="w-full pl-9"
          />
        </div>
        <Select
          aria-label="Filter by status"
          value={status}
          onChange={(event) => resetPage(setStatus)(event.target.value as VacancyStatus | "")}
          className="w-36"
        >
          <option value="">Status</option>
          {VACANCY_STATUSES.map((value) => (
            <option key={value} value={value}>
              {humanize(value)}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by work format"
          value={workFormat}
          onChange={(event) => resetPage(setWorkFormat)(event.target.value as WorkFormat | "")}
          className="w-40"
        >
          <option value="">Work format</option>
          {WORK_FORMATS.filter((value) => value !== "unknown").map((value) => (
            <option key={value} value={value}>
              {humanize(value)}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by fit"
          value={verdict}
          onChange={(event) => resetPage(setVerdict)(event.target.value as MatchVerdict | "")}
          className="w-32"
        >
          <option value="">Fit</option>
          {VERDICT_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Sort vacancies"
          value={sort}
          onChange={(event) => resetPage(setSort)(event.target.value as VacancySort)}
          className="w-40"
        >
          {SORT_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Button
          variant="outline"
          size="icon"
          aria-label="Clear filters"
          title="Clear filters"
          disabled={!filtersActive}
          onClick={clearFilters}
          className="ml-auto"
        >
          <SlidersHorizontal />
        </Button>
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader title="Vacancies" description="Save promising roles and decide what to pursue." />
      {/* The button is inlaid into the banner's top-right corner, so it sits in
          a canvas-coloured plate that notches the card behind it. */}
      <div className="relative mt-8">
        <div className="vacancies-add-manually">
          <Button
            variant="outline"
            className="vacancies-add-manually-button"
            onClick={() => navigate("/vacancies/new")}
          >
            <Plus /> Add manually
          </Button>
        </div>
        <PasteLinkCard source="vacancies" />
      </div>
      <DataTable
        toolbar={toolbar}
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(vacancy) => vacancy.id}
        loading={isLoading}
        onRowClick={(vacancy) => navigate(`/vacancies/${vacancy.id}`)}
        page={data?.page}
        pageSize={data?.page_size}
        total={data?.total}
        onPageChange={setPage}
        pagination="numbered"
        emptyState={
          <EmptyState
            icon={Briefcase}
            title={filtersActive ? "Nothing matches these filters" : "No vacancies here yet"}
            description={
              filtersActive
                ? "Try a different search or clear the filters."
                : "Paste a job link above, or add a vacancy manually to start tracking it."
            }
            action={
              filtersActive ? (
                <Button variant="outline" size="sm" className="mt-1" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-1"
                  onClick={() => navigate("/vacancies/new")}
                >
                  Add vacancy
                </Button>
              )
            }
          />
        }
      />
    </div>
  );
}
