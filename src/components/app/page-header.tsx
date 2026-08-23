export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-md border-b border-border pb-md">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-headline-md text-fg sm:text-headline-lg">{title}</h1>
          {description && <p className="mt-2 text-body-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-xs">{actions}</div>}
      </div>
    </div>
  );
}
