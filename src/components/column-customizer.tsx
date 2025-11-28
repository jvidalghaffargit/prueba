"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ChevronUp, ChevronDown, GripVertical } from "lucide-react";
import type { ColumnConfig } from "@/lib/definitions";

type ColumnCustomizerProps = {
  isOpen: boolean;
  onClose: () => void;
  columns: ColumnConfig[];
  onColumnChange: (columns: ColumnConfig[]) => void;
};

export function ColumnCustomizer({
  isOpen,
  onClose,
  columns,
  onColumnChange,
}: ColumnCustomizerProps) {
  const handleVisibilityChange = (key: string, isVisible: boolean) => {
    const newColumns = columns.map((col) =>
      col.key === key ? { ...col, isVisible } : col
    );
    onColumnChange(newColumns);
  };

  const moveColumn = (index: number, direction: 'up' | 'down') => {
    const newColumns = [...columns];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex >= 0 && newIndex < newColumns.length) {
      const [movedItem] = newColumns.splice(index, 1);
      newColumns.splice(newIndex, 0, movedItem);
      onColumnChange(newColumns);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Customize Columns</DialogTitle>
          <DialogDescription>
            Choose which columns to display and in what order.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <p className="text-sm text-muted-foreground">Toggle visibility and reorder columns for the table and file export.</p>
          <div className="space-y-2">
            {columns.map((col, index) => (
              <div
                key={col.key}
                className="flex items-center justify-between p-2 rounded-md border"
              >
                <div className="flex items-center gap-2">
                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                  <Label htmlFor={`visibility-${col.key}`} className="font-medium">
                    {col.label}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => moveColumn(index, 'up')}
                            disabled={index === 0}
                        >
                            <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => moveColumn(index, 'down')}
                            disabled={index === columns.length - 1}
                        >
                            <ChevronDown className="h-4 w-4" />
                        </Button>
                    </div>
                  <Switch
                    id={`visibility-${col.key}`}
                    checked={col.isVisible}
                    onCheckedChange={(checked) =>
                      handleVisibilityChange(col.key, checked)
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
