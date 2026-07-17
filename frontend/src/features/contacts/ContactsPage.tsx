import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Users } from "lucide-react";
import {
  CONTACT_STATUSES,
  CONTACT_TYPES,
  listContacts,
  type Contact,
  type ContactStatus,
  type ContactType,
} from "@/features/contacts/api";
import { ContactStatusBadge, ContactTypeBadge } from "@/features/contacts/badges";
import { DataTable, type Column } from "@/shared/data-table/DataTable";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { PageHeader } from "@/shared/layout/PageHeader";
import { humanize } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";

const columns: Column<Contact>[] = [
  {
    key: "name",
    header: "Name",
    render: (c) => (
      <span>
        <span className="block font-medium">
          {c.first_name} {c.last_name ?? ""}
        </span>
        {c.position && <span className="block text-xs text-muted-foreground">{c.position}</span>}
      </span>
    ),
  },
  { key: "type", header: "Type", render: (c) => <ContactTypeBadge type={c.contact_type} /> },
  { key: "status", header: "Status", render: (c) => <ContactStatusBadge status={c.status} /> },
  { key: "company", header: "Company", render: (c) => c.company?.name ?? "—" },
  {
    key: "channel",
    header: "Reach via",
    render: (c) => c.email ?? c.telegram ?? c.phone ?? "—",
  },
];

export function ContactsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<ContactType | "">("");
  const [status, setStatus] = useState<ContactStatus | "">("");
  const debouncedSearch = useDebouncedValue(search);

  const params = {
    page,
    search: debouncedSearch || undefined,
    contact_type: type || undefined,
    status: status || undefined,
  };
  const { data, isLoading } = useQuery({
    queryKey: ["contacts", params],
    queryFn: () => listContacts(params),
  });

  return (
    <div>
      <PageHeader
        title="Contacts"
        description="Recruiters, hiring managers and your professional network"
        actions={
          <Button size="sm" onClick={() => navigate("/contacts/new")}>
            <Plus /> Add contact
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search by name, email or company..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        <Select
          value={type}
          onChange={(e) => {
            setType(e.target.value as ContactType | "");
            setPage(1);
          }}
          className="w-44"
        >
          <option value="">All types</option>
          {CONTACT_TYPES.map((t) => (
            <option key={t} value={t}>
              {humanize(t)}
            </option>
          ))}
        </Select>
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as ContactStatus | "");
            setPage(1);
          }}
          className="w-44"
        >
          <option value="">All statuses</option>
          {CONTACT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {humanize(s)}
            </option>
          ))}
        </Select>
      </div>
      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(c) => c.id}
        loading={isLoading}
        onRowClick={(c) => navigate(`/contacts/${c.id}`)}
        page={data?.page}
        pageSize={data?.page_size}
        total={data?.total}
        onPageChange={setPage}
        emptyState={
          <EmptyState
            icon={Users}
            title="No contacts yet"
            description="Add recruiters and hiring managers you talk to."
            action={
              <Button variant="outline" size="sm" className="mt-1">
                <Link to="/contacts/new">Add contact</Link>
              </Button>
            }
          />
        }
      />
    </div>
  );
}
