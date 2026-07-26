import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Download, FileText, Plus, RefreshCw, Send, Trash2 } from "lucide-react";
import {
  deleteCVVersion,
  downloadCVFile,
  extractCVVersion,
  listCVVersions,
  type CVVersion,
} from "@/features/cv-library/api";
import { ExtractionStatusBadge, extractionHint } from "@/features/cv-library/ExtractionStatusBadge";
import { DataTable, type Column } from "@/shared/data-table/DataTable";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { PageHeader } from "@/shared/layout/PageHeader";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input } from "@/shared/ui/input";

function formatSize(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CVLibraryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const params = { page, search: debouncedSearch || undefined };
  const { data, isLoading } = useQuery({
    queryKey: ["cv-versions", params],
    queryFn: () => listCVVersions(params),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCVVersion,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cv-versions"] }),
  });

  const extractMutation = useMutation({
    mutationFn: extractCVVersion,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cv-versions"] }),
  });

  const columns: Column<CVVersion>[] = [
    {
      key: "title",
      header: "Title",
      render: (cv) => (
        <span className="flex items-center gap-2 font-medium">
          <FileText className="size-4 text-muted-foreground" /> {cv.title}
        </span>
      ),
    },
    { key: "language", header: "Language", render: (cv) => cv.language ?? "—" },
    { key: "specialization", header: "Specialization", render: (cv) => cv.specialization ?? "—" },
    { key: "file", header: "File", render: (cv) => cv.file_name },
    { key: "size", header: "Size", render: (cv) => formatSize(cv.file_size) },
    {
      key: "extraction",
      header: "Text",
      render: (cv) => <ExtractionStatusBadge cv={cv} />,
    },
    {
      key: "updated",
      header: "Updated",
      render: (cv) => (
        <span className="text-muted-foreground">
          {format(new Date(cv.updated_at), "d MMM yyyy")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-40",
      render: (cv) => (
        <span className="flex items-center justify-end gap-1">
          {(cv.extraction_status === "failed" || cv.extraction_status === "pending") && (
            <Button
              variant="ghost"
              size="icon"
              title={`${extractionHint(cv)} Click to read it again.`}
              disabled={extractMutation.isPending}
              onClick={(e) => {
                e.stopPropagation();
                extractMutation.mutate(cv.id);
              }}
            >
              <RefreshCw />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            title="Applications using this CV"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/applications?cv_version_id=${cv.id}`);
            }}
          >
            <Send />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Download"
            onClick={(e) => {
              e.stopPropagation();
              void downloadCVFile(cv);
            }}
          >
            <Download />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Delete"
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm("Delete this CV version?")) deleteMutation.mutate(cv.id);
            }}
          >
            <Trash2 className="text-destructive" />
          </Button>
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="CV Library"
        description="Your resume versions and where they were used"
        actions={
          <Button size="sm" onClick={() => navigate("/cv-library/new")}>
            <Plus /> Upload CV
          </Button>
        }
      />
      <div className="mb-4">
        <Input
          placeholder="Search by title or specialization..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
      </div>
      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(cv) => cv.id}
        loading={isLoading}
        page={data?.page}
        pageSize={data?.page_size}
        total={data?.total}
        onPageChange={setPage}
        emptyState={
          <EmptyState
            icon={FileText}
            title="No CV versions yet"
            description="Upload your first resume to link it to applications."
            action={
              <Button variant="outline" size="sm" className="mt-1">
                <Link to="/cv-library/new">Upload CV</Link>
              </Button>
            }
          />
        }
      />
    </div>
  );
}
