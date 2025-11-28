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
import { Badge } from "@/components/ui/badge";
import type { Invoice, ColumnConfig } from "@/lib/definitions";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type InvoiceTableProps = {
  invoices: Invoice[];
  columns: ColumnConfig[];
  onEdit: (invoice: Invoice) => void;
  onDelete: (id: string) => void;
};

export function InvoiceTable({
  invoices,
  columns,
  onEdit,
  onDelete,
}: InvoiceTableProps) {
  const getStatusBadgeVariant = (
    status: "Paid" | "Pending" | "Overdue"
  ) => {
    switch (status) {
      case "Paid":
        return "default";
      case "Pending":
        return "secondary";
      case "Overdue":
        return "destructive";
      default:
        return "outline";
    }
  };

  const formatValue = (invoice: Invoice, column: ColumnConfig) => {
    const value = invoice[column.key as keyof Invoice];
    switch (column.key) {
      case "date":
        if (value instanceof Date) {
            return format(value, "yyyy-MM-dd");
        }
        return String(value);
      case "amount":
        return (value as number).toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
        });
      case "status":
        return (
          <Badge
            className={cn({
              'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200': value === 'Paid',
              'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200': value === 'Pending',
              'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200': value === 'Overdue',
            })}
            variant={getStatusBadgeVariant(
              value as "Paid" | "Pending" | "Overdue"
            )}
          >
            {value as string}
          </Badge>
        );
      default:
        return value as string | number;
    }
  };

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16 text-muted-foreground">
        <FileX className="w-16 h-16 mb-4" />
        <h3 className="text-xl font-semibold">No Invoices Found</h3>
        <p>Click 'Add Invoice' to get started.</p>
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
                      onClick={() => onDelete(invoice.id)}
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
