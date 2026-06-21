import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterSelectConfig {
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  placeholder?: string;
  testId?: string;
  className?: string;
}

export function DataFiltersBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  searchTestId = "input-search",
  filters = [],
  "data-testid": testId,
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  searchTestId?: string;
  filters?: FilterSelectConfig[];
  "data-testid"?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-2" data-testid={testId || "data-filters-bar"}>
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
          data-testid={searchTestId}
        />
      </div>
      {filters.map((filter) => (
        <Select key={filter.testId || filter.placeholder} value={filter.value} onValueChange={filter.onChange}>
          <SelectTrigger className={filter.className || "w-full sm:w-44"} data-testid={filter.testId}>
            <SelectValue placeholder={filter.placeholder || "Filter"} />
          </SelectTrigger>
          <SelectContent>
            {filter.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
    </div>
  );
}
