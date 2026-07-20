import { Link } from "wouter";
import { ChevronRight } from "lucide-react";

export type Crumb = { label: string; href?: string };

/**
 * Accessible breadcrumb trail. Improves orientation (UX), strengthens internal
 * linking between traditions and scriptures (content connection), and pairs with
 * the BreadcrumbList JSON-LD injected via useEntitySeo for richer search results.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1.5">
              {item.href && !isLast ? (
                <Link href={item.href} className="hover:text-foreground transition-colors">
                  {item.label}
                </Link>
              ) : (
                <span className={isLast ? "text-foreground font-medium" : ""} aria-current={isLast ? "page" : undefined}>
                  {item.label}
                </span>
              )}
              {!isLast && <ChevronRight className="w-3.5 h-3.5 opacity-50" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
