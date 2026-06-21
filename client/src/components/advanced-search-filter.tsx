import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Search,
  Filter,
  X,
  Calendar as CalendarIcon,
  Tag,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from "lucide-react";
import { format, isAfter, isBefore, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";

export interface FilterOption {
  id: string;
  label: string;
  icon?: React.ElementType;
  color?: string;
}

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export interface SearchFilters {
  keyword: string;
  dateRange: DateRange;
  selectedTypes: string[];
  selectedTags: string[];
}

interface AdvancedSearchFilterProps {
  placeholder?: string;
  typeOptions?: FilterOption[];
  tagOptions?: FilterOption[];
  showDateFilter?: boolean;
  showTypeFilter?: boolean;
  showTagFilter?: boolean;
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  className?: string;
  compactMode?: boolean;
}

export function AdvancedSearchFilter({
  placeholder = "Search...",
  typeOptions = [],
  tagOptions = [],
  showDateFilter = true,
  showTypeFilter = true,
  showTagFilter = true,
  filters,
  onFiltersChange,
  className,
  compactMode = false,
}: AdvancedSearchFilterProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);

  const activeFilterCount = 
    (filters.keyword ? 1 : 0) +
    (filters.dateRange.from || filters.dateRange.to ? 1 : 0) +
    filters.selectedTypes.length +
    filters.selectedTags.length;

  const updateFilters = useCallback((partial: Partial<SearchFilters>) => {
    onFiltersChange({ ...filters, ...partial });
  }, [filters, onFiltersChange]);

  const toggleType = (typeId: string) => {
    const newTypes = filters.selectedTypes.includes(typeId)
      ? filters.selectedTypes.filter(t => t !== typeId)
      : [...filters.selectedTypes, typeId];
    updateFilters({ selectedTypes: newTypes });
  };

  const toggleTag = (tagId: string) => {
    const newTags = filters.selectedTags.includes(tagId)
      ? filters.selectedTags.filter(t => t !== tagId)
      : [...filters.selectedTags, tagId];
    updateFilters({ selectedTags: newTags });
  };

  const clearFilters = () => {
    onFiltersChange({
      keyword: "",
      dateRange: { from: undefined, to: undefined },
      selectedTypes: [],
      selectedTags: [],
    });
  };

  const removeFilter = (type: "keyword" | "date" | "type" | "tag", value?: string) => {
    switch (type) {
      case "keyword":
        updateFilters({ keyword: "" });
        break;
      case "date":
        updateFilters({ dateRange: { from: undefined, to: undefined } });
        break;
      case "type":
        if (value) toggleType(value);
        break;
      case "tag":
        if (value) toggleTag(value);
        break;
    }
  };

  const formatDateRange = () => {
    if (filters.dateRange.from && filters.dateRange.to) {
      return `${format(filters.dateRange.from, "MMM d, yyyy")} - ${format(filters.dateRange.to, "MMM d, yyyy")}`;
    }
    if (filters.dateRange.from) {
      return `From ${format(filters.dateRange.from, "MMM d, yyyy")}`;
    }
    if (filters.dateRange.to) {
      return `Until ${format(filters.dateRange.to, "MMM d, yyyy")}`;
    }
    return "Select dates";
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={placeholder}
            value={filters.keyword}
            onChange={(e) => updateFilters({ keyword: e.target.value })}
            className="pl-9 pr-8"
            data-testid="input-search-keyword"
          />
          {filters.keyword && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() => updateFilters({ keyword: "" })}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {showDateFilter && (
          <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "min-w-[140px] justify-start text-left font-normal",
                  (filters.dateRange.from || filters.dateRange.to) && "border-primary"
                )}
                data-testid="button-date-filter"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                <span className="truncate">
                  {filters.dateRange.from || filters.dateRange.to
                    ? formatDateRange()
                    : "Date Range"}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="p-3 border-b">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const today = new Date();
                      updateFilters({
                        dateRange: {
                          from: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7),
                          to: today,
                        },
                      });
                    }}
                  >
                    Last 7 days
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const today = new Date();
                      updateFilters({
                        dateRange: {
                          from: new Date(today.getFullYear(), today.getMonth() - 1, today.getDate()),
                          to: today,
                        },
                      });
                    }}
                  >
                    Last 30 days
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const today = new Date();
                      updateFilters({
                        dateRange: {
                          from: new Date(today.getFullYear(), 0, 1),
                          to: today,
                        },
                      });
                    }}
                  >
                    This year
                  </Button>
                </div>
              </div>
              <Calendar
                mode="range"
                selected={{
                  from: filters.dateRange.from,
                  to: filters.dateRange.to,
                }}
                onSelect={(range) => {
                  updateFilters({
                    dateRange: {
                      from: range?.from,
                      to: range?.to,
                    },
                  });
                }}
                numberOfMonths={2}
                data-testid="calendar-date-range"
              />
              <div className="p-3 border-t flex justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateFilters({ dateRange: { from: undefined, to: undefined } })}
                >
                  Clear
                </Button>
                <Button size="sm" onClick={() => setDatePopoverOpen(false)}>
                  Apply
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        )}

        <Button
          variant="outline"
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(activeFilterCount > 0 && "border-primary")}
          data-testid="button-toggle-filters"
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1">
              {activeFilterCount}
            </Badge>
          )}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 ml-1" />
          ) : (
            <ChevronDown className="h-4 w-4 ml-1" />
          )}
        </Button>

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            data-testid="button-clear-filters"
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Clear all
          </Button>
        )}
      </div>

      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.keyword && (
            <Badge variant="secondary" className="gap-1">
              <Search className="h-3 w-3" />
              "{filters.keyword}"
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                onClick={() => removeFilter("keyword")}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          {(filters.dateRange.from || filters.dateRange.to) && (
            <Badge variant="secondary" className="gap-1">
              <CalendarIcon className="h-3 w-3" />
              {formatDateRange()}
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                onClick={() => removeFilter("date")}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          {filters.selectedTypes.map(typeId => {
            const typeOption = typeOptions.find(t => t.id === typeId);
            return (
              <Badge key={typeId} variant="secondary" className="gap-1">
                {typeOption?.icon && <typeOption.icon className="h-3 w-3" />}
                {typeOption?.label || typeId}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                  onClick={() => removeFilter("type", typeId)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            );
          })}
          {filters.selectedTags.map(tagId => {
            const tagOption = tagOptions.find(t => t.id === tagId);
            return (
              <Badge key={tagId} variant="secondary" className="gap-1">
                <Tag className="h-3 w-3" />
                {tagOption?.label || tagId}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                  onClick={() => removeFilter("tag", tagId)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            );
          })}
        </div>
      )}

      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleContent>
          <Card className="mt-2">
            <CardContent className="p-4">
              <div className="grid gap-4 md:grid-cols-2">
                {showTypeFilter && typeOptions.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Event Types</Label>
                    <ScrollArea className="h-36 rounded-md border p-2">
                      <div className="space-y-1">
                        {typeOptions.map(option => (
                          <div
                            key={option.id}
                            className="flex items-center space-x-2 p-1 rounded hover-elevate cursor-pointer"
                            onClick={() => toggleType(option.id)}
                          >
                            <Checkbox
                              id={`type-${option.id}`}
                              checked={filters.selectedTypes.includes(option.id)}
                              onCheckedChange={() => toggleType(option.id)}
                              data-testid={`checkbox-type-${option.id}`}
                            />
                            <label
                              htmlFor={`type-${option.id}`}
                              className="flex items-center gap-2 text-sm cursor-pointer flex-1"
                            >
                              {option.icon && <option.icon className="h-4 w-4 text-muted-foreground" />}
                              {option.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {showTagFilter && tagOptions.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Tags</Label>
                    <ScrollArea className="h-36 rounded-md border p-2">
                      <div className="space-y-1">
                        {tagOptions.map(option => (
                          <div
                            key={option.id}
                            className="flex items-center space-x-2 p-1 rounded hover-elevate cursor-pointer"
                            onClick={() => toggleTag(option.id)}
                          >
                            <Checkbox
                              id={`tag-${option.id}`}
                              checked={filters.selectedTags.includes(option.id)}
                              onCheckedChange={() => toggleTag(option.id)}
                              data-testid={`checkbox-tag-${option.id}`}
                            />
                            <label
                              htmlFor={`tag-${option.id}`}
                              className="flex items-center gap-2 text-sm cursor-pointer flex-1"
                            >
                              <Tag className="h-3 w-3 text-muted-foreground" />
                              {option.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export function useAdvancedFilters<T>(
  items: T[],
  filters: SearchFilters,
  config: {
    getKeywords: (item: T) => string[];
    getDate: (item: T) => Date | string | undefined;
    getType: (item: T) => string | undefined;
    getTags: (item: T) => string[];
  }
): T[] {
  const { keyword, dateRange, selectedTypes, selectedTags } = filters;
  const { getKeywords, getDate, getType, getTags } = config;

  return items.filter(item => {
    if (keyword) {
      const keywords = getKeywords(item).join(" ").toLowerCase();
      if (!keywords.includes(keyword.toLowerCase())) {
        return false;
      }
    }

    if (dateRange.from || dateRange.to) {
      const itemDateValue = getDate(item);
      if (!itemDateValue) return false;
      
      const itemDate = typeof itemDateValue === "string" ? new Date(itemDateValue) : itemDateValue;
      
      if (dateRange.from && dateRange.to) {
        if (!isWithinInterval(itemDate, { 
          start: startOfDay(dateRange.from), 
          end: endOfDay(dateRange.to) 
        })) {
          return false;
        }
      } else if (dateRange.from) {
        if (isBefore(itemDate, startOfDay(dateRange.from))) {
          return false;
        }
      } else if (dateRange.to) {
        if (isAfter(itemDate, endOfDay(dateRange.to))) {
          return false;
        }
      }
    }

    if (selectedTypes.length > 0) {
      const itemType = getType(item);
      if (!itemType || !selectedTypes.includes(itemType)) {
        return false;
      }
    }

    if (selectedTags.length > 0) {
      const itemTags = getTags(item);
      if (!selectedTags.some(tag => itemTags.includes(tag))) {
        return false;
      }
    }

    return true;
  });
}

export const defaultFilters: SearchFilters = {
  keyword: "",
  dateRange: { from: undefined, to: undefined },
  selectedTypes: [],
  selectedTags: [],
};
