import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CANCER_FOLDER_TAXONOMY,
  CancerFolderType,
  CancerFolderNode,
  cancerFolderLabels,
  getCancerFolderPath,
  flattenCancerFolderTaxonomy,
  TAG_CATEGORIES,
  TagCategory,
  getTagLabel,
  isValidMachineTag,
  exportTagSchema,
  MachineTag,
} from "@shared/schema";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  Search,
  Download,
  Shield,
  Microscope,
  ScanLine,
  Stethoscope,
  Droplets,
  TestTube,
  ClipboardList,
  AlertTriangle,
  Heart,
  CreditCard,
  Tag,
  Check,
  X,
} from "lucide-react";

interface CancerFolderBrowserProps {
  selectedFolder?: CancerFolderType | null;
  onFolderSelect?: (folderType: CancerFolderType) => void;
  documentCounts?: Record<CancerFolderType, number>;
  selectedTags?: string[];
  onTagToggle?: (tag: string) => void;
  showTagFilter?: boolean;
  compact?: boolean;
  className?: string;
}

const folderIcons: Record<string, typeof Folder> = {
  Microscope: Microscope,
  ScanLine: ScanLine,
  Stethoscope: Stethoscope,
  Droplets: Droplets,
  TestTube: TestTube,
  ClipboardList: ClipboardList,
  AlertTriangle: AlertTriangle,
  Heart: Heart,
  CreditCard: CreditCard,
  Folder: Folder,
};

function getFolderIcon(iconName?: string) {
  if (!iconName) return Folder;
  return folderIcons[iconName] || Folder;
}

interface FolderItemProps {
  node: CancerFolderNode;
  level: number;
  selectedFolder?: CancerFolderType | null;
  onSelect: (folderType: CancerFolderType) => void;
  documentCounts?: Record<CancerFolderType, number>;
  expandedFolders: Set<CancerFolderType>;
  onToggleExpand: (folderType: CancerFolderType) => void;
}

function FolderItem({
  node,
  level,
  selectedFolder,
  onSelect,
  documentCounts,
  expandedFolders,
  onToggleExpand,
}: FolderItemProps) {
  const isSelected = selectedFolder === node.id;
  const isExpanded = expandedFolders.has(node.id);
  const hasChildren = node.children && node.children.length > 0;
  const count = documentCounts?.[node.id] || 0;
  
  const totalCount = useMemo(() => {
    if (!hasChildren || !documentCounts) return count;
    let total = count;
    node.children?.forEach(child => {
      total += documentCounts[child.id] || 0;
    });
    return total;
  }, [node, documentCounts, count, hasChildren]);

  const IconComponent = getFolderIcon(node.icon);

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-2 px-2 rounded-md cursor-pointer transition-colors min-h-[44px] ${
          isSelected
            ? "bg-primary/10 text-primary"
            : "hover-elevate"
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onSelect(node.id)}
        data-testid={`folder-${node.id}`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(node.id);
          }
        }}
        // `aria-selected` belongs to grid/listbox/tab/treeitem roles, not to
        // `button`. `aria-current` is the supported way to announce which
        // folder in the list is the one being viewed.
        aria-current={isSelected ? "true" : undefined}
        aria-expanded={hasChildren ? isExpanded : undefined}
      >
        {hasChildren && (
          <button
            className="p-1 hover-elevate rounded"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
            data-testid={`toggle-${node.id}`}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        )}
        {!hasChildren && <div className="w-6" />}
        
        {isExpanded ? (
          <FolderOpen className="h-5 w-5 text-primary flex-shrink-0" aria-hidden="true" />
        ) : (
          <IconComponent className="h-5 w-5 text-muted-foreground flex-shrink-0" aria-hidden="true" />
        )}
        
        <span className="flex-1 truncate text-sm font-medium">{node.label}</span>
        
        {totalCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            {totalCount}
          </Badge>
        )}
      </div>
      
      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child) => (
            <FolderItem
              key={child.id}
              node={child}
              level={level + 1}
              selectedFolder={selectedFolder}
              onSelect={onSelect}
              documentCounts={documentCounts}
              expandedFolders={expandedFolders}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CancerFolderBrowser({
  selectedFolder,
  onFolderSelect,
  documentCounts,
  selectedTags = [],
  onTagToggle,
  showTagFilter = false,
  compact = false,
  className = "",
}: CancerFolderBrowserProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<CancerFolderType>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const handleToggleExpand = (folderType: CancerFolderType) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderType)) {
        next.delete(folderType);
      } else {
        next.add(folderType);
      }
      return next;
    });
  };

  const handleFolderSelect = (folderType: CancerFolderType) => {
    onFolderSelect?.(folderType);
  };

  const expandAll = () => {
    const allParents = CANCER_FOLDER_TAXONOMY
      .filter(node => node.children && node.children.length > 0)
      .map(node => node.id);
    setExpandedFolders(new Set(allParents));
  };

  const collapseAll = () => {
    setExpandedFolders(new Set());
  };

  const filteredTaxonomy = useMemo(() => {
    if (!searchQuery.trim()) return CANCER_FOLDER_TAXONOMY;
    
    const query = searchQuery.toLowerCase();
    return CANCER_FOLDER_TAXONOMY.filter(parent => {
      const parentMatches = parent.label.toLowerCase().includes(query);
      const childMatches = parent.children?.some(child => 
        child.label.toLowerCase().includes(query)
      );
      return parentMatches || childMatches;
    }).map(parent => ({
      ...parent,
      children: parent.children?.filter(child =>
        child.label.toLowerCase().includes(query) ||
        parent.label.toLowerCase().includes(query)
      ),
    }));
  }, [searchQuery]);

  const selectedPath = selectedFolder ? getCancerFolderPath(selectedFolder) : null;

  if (compact) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="flex items-center gap-2 text-sm">
          <Folder className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="font-medium">Cancer Track</span>
          {selectedPath && (
            <>
              {selectedPath.map((segment, i) => (
                <span key={i} className="flex items-center gap-1">
                  <ChevronRight className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                  <span className={i === selectedPath.length - 1 ? "text-primary" : "text-muted-foreground"}>
                    {segment}
                  </span>
                </span>
              ))}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Folder className="h-5 w-5" aria-hidden="true" />
              Cancer Track Folders
            </CardTitle>
            <CardDescription>
              Organized document storage for cancer care
            </CardDescription>
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={expandAll}
              data-testid="button-expand-all"
            >
              Expand
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={collapseAll}
              data-testid="button-collapse-all"
            >
              Collapse
            </Button>
          </div>
        </div>
        
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Search folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-folder-search"
            aria-label="Search folders"
          />
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <Alert className="mb-4">
          <Shield className="h-4 w-4" aria-hidden="true" />
          <AlertDescription className="text-xs">
            <strong>Educational Only:</strong> Document organization is for record-keeping purposes. 
            This is NOT medical advice.
          </AlertDescription>
        </Alert>

        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-1" role="tree" aria-label="Cancer Track folder structure">
            {filteredTaxonomy.map((node) => (
              <FolderItem
                key={node.id}
                node={node}
                level={0}
                selectedFolder={selectedFolder}
                onSelect={handleFolderSelect}
                documentCounts={documentCounts}
                expandedFolders={expandedFolders}
                onToggleExpand={handleToggleExpand}
              />
            ))}
          </div>
        </ScrollArea>

        {showTagFilter && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-medium">Filter by Tags</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {TAG_CATEGORIES.slice(0, 3).flatMap(cat => 
                (cat.tags as readonly string[]).slice(0, 4).map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <Badge
                      key={tag}
                      variant={isSelected ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => onTagToggle?.(tag)}
                      data-testid={`tag-${tag}`}
                    >
                      {isSelected && <Check className="h-3 w-3 mr-1" aria-hidden="true" />}
                      {getTagLabel(tag)}
                    </Badge>
                  );
                })
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CancerFolderExportButton({ className = "" }: { className?: string }) {
  const handleExport = () => {
    const taxonomy = flattenCancerFolderTaxonomy();
    const csvContent = [
      ["Folder ID", "Folder Path", "Label", "Parent ID"].join(","),
      ...taxonomy.map(item => 
        [item.id, `"${item.path}"`, `"${item.label}"`, item.parentId || ""].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "cancer_track_folder_taxonomy.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      className={className}
      data-testid="button-export-taxonomy"
    >
      <Download className="h-4 w-4 mr-2" aria-hidden="true" />
      Export Taxonomy
    </Button>
  );
}

// Machine-friendly tag selector using the new tagging schema
export function MachineTagSelector({
  selectedTags,
  onTagsChange,
  maxTags = 10,
  categories,
  className = "",
}: {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  maxTags?: number;
  categories?: string[];
  className?: string;
}) {
  const handleToggle = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter(t => t !== tag));
    } else if (selectedTags.length < maxTags) {
      onTagsChange([...selectedTags, tag]);
    }
  };

  const filteredCategories = categories 
    ? TAG_CATEGORIES.filter(cat => categories.includes(cat.id))
    : TAG_CATEGORIES;

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Document Tags</span>
        <span className="text-xs text-muted-foreground">
          {selectedTags.length}/{maxTags} selected
        </span>
      </div>
      
      {filteredCategories.map((category) => (
        <div key={category.id}>
          <p className="text-xs text-muted-foreground mb-2">{category.label}</p>
          <div className="flex flex-wrap gap-2">
            {(category.tags as readonly string[]).map(tag => {
              const isSelected = selectedTags.includes(tag);
              const isDisabled = !isSelected && selectedTags.length >= maxTags;
              
              return (
                <Badge
                  key={tag}
                  variant={isSelected ? "default" : "outline"}
                  className={`cursor-pointer ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                  onClick={() => !isDisabled && handleToggle(tag)}
                  data-testid={`select-tag-${tag.replace(/:/g, "-")}`}
                >
                  {isSelected && <Check className="h-3 w-3 mr-1" aria-hidden="true" />}
                  {category.labels[tag] || tag}
                </Badge>
              );
            })}
          </div>
        </div>
      ))}
      
      {selectedTags.length > 0 && (
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground mb-2">Selected Tags</p>
          <div className="flex flex-wrap gap-2">
            {selectedTags.map(tag => (
              <Badge key={tag} variant="default" className="pr-1">
                {getTagLabel(tag)}
                <button
                  className="ml-1 p-0.5 hover:bg-primary-foreground/20 rounded"
                  onClick={() => handleToggle(tag)}
                  aria-label={`Remove ${getTagLabel(tag)} tag`}
                  data-testid={`remove-tag-${tag.replace(/:/g, "-")}`}
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Export tag schema as JSON for external systems
export function TagSchemaExportButton({ className = "" }: { className?: string }) {
  const handleExport = () => {
    const schema = exportTagSchema();
    const jsonContent = JSON.stringify(schema, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tabula_medica_tag_schema.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      className={className}
      data-testid="button-export-tags"
    >
      <Download className="h-4 w-4 mr-2" aria-hidden="true" />
      Export Tag Schema
    </Button>
  );
}
