import {
  AlertTriangle,
  Check,
  CircleCheck,
  Inbox,
  Info,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/shared/layout/PageHeader";
import { Alert } from "@/shared/ui/alert";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { FormField } from "@/shared/ui/form-field";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { Skeleton } from "@/shared/ui/skeleton";
import { Textarea } from "@/shared/ui/textarea";

const colors = [
  { name: "Primary", token: "bg-primary", value: "Action and brand" },
  { name: "Surface", token: "bg-surface", value: "Quiet grouping" },
  { name: "Success", token: "bg-success", value: "Positive outcome" },
  { name: "Warning", token: "bg-warning", value: "Needs attention" },
  { name: "Info", token: "bg-info", value: "Neutral guidance" },
  { name: "Destructive", token: "bg-destructive", value: "Risk or failure" },
];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 border-t border-border py-8 first:border-0 first:pt-0 lg:grid-cols-[15rem_1fr] lg:gap-10">
      <div>
        <h2 className="text-base font-semibold tracking-[-0.01em]">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export function DesignSystemPage() {
  return (
    <div>
      <PageHeader
        title="Design system"
        description="The shared visual language and interaction contract for Niti. Foundation v0.2."
        actions={<Badge variant="info">Internal reference</Badge>}
      />

      <Section
        title="Color roles"
        description="Use semantic roles in product code. Palette values stay private to the token layer."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {colors.map((color) => (
            <Card key={color.name} variant="outline" className="flex items-center gap-3 p-3">
              <span className={`size-10 shrink-0 rounded-md ${color.token}`} />
              <span>
                <span className="block text-sm font-semibold">{color.name}</span>
                <span className="block text-xs text-muted-foreground">{color.value}</span>
              </span>
            </Card>
          ))}
        </div>
      </Section>

      <Section
        title="Typography"
        description="A compact product scale with strong hierarchy and comfortable reading rhythm."
      >
        <Card variant="outline" className="overflow-hidden">
          <div className="border-b border-border p-5">
            <p className="text-3xl font-semibold tracking-[-0.03em]">Display / 30 semibold</p>
          </div>
          <div className="border-b border-border p-5">
            <p className="text-2xl font-semibold tracking-[-0.025em]">Page title / 24 semibold</p>
          </div>
          <div className="border-b border-border p-5">
            <p className="text-base font-semibold">Section title / 16 semibold</p>
          </div>
          <div className="grid gap-2 p-5">
            <p className="text-sm">Body / 14 regular — built for dense CRM workflows.</p>
            <p className="text-sm text-muted-foreground">Secondary / 14 regular — supporting context.</p>
            <p className="text-xs font-medium text-subtle-foreground">CAPTION / 12 MEDIUM</p>
          </div>
        </Card>
      </Section>

      <Section
        title="Actions"
        description="One primary action per region. Secondary and ghost actions preserve hierarchy."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button><Plus /> Primary</Button>
          <Button variant="secondary"><Check /> Secondary</Button>
          <Button variant="outline"><Search /> Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive"><Trash2 /> Delete</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="xs">Extra small</Button>
          <Button size="sm">Small</Button>
          <Button>Default</Button>
          <Button size="lg">Large</Button>
          <Button size="icon" aria-label="Search"><Search /></Button>
        </div>
      </Section>

      <Section
        title="Status"
        description="Badges label state; alerts explain feedback that needs more context."
      >
        <div className="flex flex-wrap gap-2">
          <Badge>Applied</Badge>
          <Badge variant="muted">Draft</Badge>
          <Badge variant="success">Offer</Badge>
          <Badge variant="warning">Follow up</Badge>
          <Badge variant="info">Interview</Badge>
          <Badge variant="destructive">Rejected</Badge>
          <Badge variant="outline">Archived</Badge>
        </div>
        <div className="mt-5 grid gap-3 xl:grid-cols-2">
          <Alert variant="info" icon={<Info />} title="Interview scheduled">
            We will remind you one day before the call.
          </Alert>
          <Alert variant="success" icon={<CircleCheck />} title="Changes saved">
            Your application has been updated.
          </Alert>
          <Alert variant="warning" icon={<AlertTriangle />} title="Possible duplicate">
            A similar vacancy already exists in your workspace.
          </Alert>
          <Alert variant="destructive" icon={<AlertTriangle />} title="Could not save">
            Check the required fields and try again.
          </Alert>
        </div>
      </Section>

      <Section
        title="Forms"
        description="Labels remain visible, supporting copy is concise, and errors sit next to their field."
      >
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Application details</CardTitle>
            <CardDescription>A representative form composition.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Role" htmlFor="ds-role">
                <Input id="ds-role" defaultValue="Product Designer" />
              </FormField>
              <FormField label="Stage" htmlFor="ds-stage">
                <Select id="ds-stage" defaultValue="interview">
                  <option value="applied">Applied</option>
                  <option value="interview">Interview</option>
                  <option value="offer">Offer</option>
                </Select>
              </FormField>
            </div>
            <FormField label="Notes" htmlFor="ds-notes" optional hint="Visible only to you.">
              <Textarea id="ds-notes" placeholder="Add useful context…" />
            </FormField>
            <FormField label="Portfolio URL" htmlFor="ds-url" error="Enter a valid URL.">
              <Input id="ds-url" aria-invalid="true" defaultValue="my portfolio" />
            </FormField>
          </CardContent>
        </Card>
      </Section>

      <Section
        title="Containers and states"
        description="Cards group related information; empty and loading states preserve the page structure."
      >
        <div className="grid gap-4 xl:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Standard card</CardTitle>
              <CardDescription>Default container for related content.</CardDescription>
            </CardHeader>
            <CardContent><p className="text-sm">Stable, quiet elevation above the workspace.</p></CardContent>
          </Card>
          <Card variant="muted">
            <CardHeader>
              <CardTitle>Muted card</CardTitle>
              <CardDescription>Useful for secondary groups.</CardDescription>
            </CardHeader>
            <CardContent><p className="text-sm">No border or elevation required.</p></CardContent>
          </Card>
          <Card variant="interactive">
            <CardHeader>
              <CardTitle>Interactive card</CardTitle>
              <CardDescription>Reserved for clickable objects.</CardDescription>
            </CardHeader>
            <CardContent><p className="text-sm">Hover reveals affordance.</p></CardContent>
          </Card>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <EmptyState
            icon={Inbox}
            title="Nothing here yet"
            description="New records will appear here when you add them."
            action={<Button size="sm"><Plus /> Add item</Button>}
          />
          <Card variant="outline" className="grid content-center gap-4 p-6">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-10 w-full" />
          </Card>
        </div>
      </Section>
    </div>
  );
}
