"use client";

import {
  MoreHorizontal,
  Pencil,
  Trash2,
  FileX,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Invoice, ColumnConfig } from "@/lib/definitions";
import { format } from "date-fns";

type InvoiceTableProps = {
  invoices: Invoice[];
  columns: ColumnConfig[];
  onEdit: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
};

// Helper to convert Firestore Timestamp to JS Date
const toDate = (value: Invoice['date']): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'seconds' in value) {
    return new Date((value as any).seconds * 1000);
  }
  const parsed = new Date(value as any);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function InvoiceTable({
  invoices,
  columns,
  onEdit,
  onDelete,
}: InvoiceTableProps) {
  
  const formatValue = (invoice: Invoice, column: ColumnConfig) => {
    const value = invoice[column.key as keyof Invoice];
    switch (column.key) {
      case "date":
        const dateValue = toDate(value as Invoice['date']);
        if (dateValue) {
          return format(dateValue, "yyyy-MM-dd");
        }
        return "Invalid Date";

      case "baseAmount":
      case "vatAmount":
      case "totalAmount":
        return (value as number)?.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
        }) || (0).toLocaleString("en-US", { style: "currency", currency: "USD" });
      case "vatRate":
         return value ? `${value}%` : 'N/A';
      default:
        return (value as string | number) || "N/A";
    }
  };

  if (!invoices || invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16 text-muted-foreground">
        <FileX className="w-16 h-16 mb-4" />
        <h3 className="text-xl font-semibold">No Invoices Found</h3>
        <p>Add an invoice or scan one to get started.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.key}>{col.label}</TableHead>
            ))}
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow key={invoice.id}>
              {columns.map((col) => (
                <TableCell key={`${invoice.id}-${col.key}`}>
                  {formatValue(invoice, col)}
                </TableCell>
              ))}
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <span className="sr-only">Open menu</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(invoice)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      <span>Edit</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive focus:bg-destructive/10"
                      onClick={() => onDelete(invoice)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      <span>Delete</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
