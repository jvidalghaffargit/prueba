"use client";

import React, { useState, useMemo } from "react";
import {
  Download,
  FileSpreadsheet,
  Plus,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Invoice, ColumnConfig } from "@/lib/definitions";
import { InvoiceTable } from "@/components/invoice-table";
import { InvoiceForm } from "@/components/invoice-form";
import { ColumnCustomizer } from "@/components/column-customizer";
import { useToast } from "@/hooks/use-toast";

const initialInvoicesData: Invoice[] = [
  {
    id: "inv-001",
    invoiceId: "INV-2024-001",
    customerName: "Acme Inc.",
    amount: 1250.75,
    date: new Date("2024-07-15"),
    status: "Paid",
  },
  {
    id: "inv-002",
    invoiceId: "INV-2024-002",
    customerName: "Stark Industries",
    amount: 5420.0,
    date: new Date("2024-07-20"),
    status: "Pending",
  },
  {
    id: "inv-003",
    invoiceId: "INV-2024-003",
    customerName: "Wayne Enterprises",
    amount: 899.99,
    date: new Date("2024-06-30"),
    status: "Overdue",
  },
];

const initialColumnsData: ColumnConfig[] = [
  { key: "invoiceId", label: "Invoice ID", isVisible: true },
  { key: "customerName", label: "Customer", isVisible: true },
  { key: "date", label: "Date", isVisible: true },
  { key: "amount", label: "Amount", isVisible: true },
  { key: "status", label: "Status", isVisible: true },
];

export default function Home() {
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoicesData);
  const [columns, setColumns] = useState<ColumnConfig[]>(initialColumnsData);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [invoiceToEdit, setInvoiceToEdit] = useState<Invoice | undefined>(
    undefined
  );
  const { toast } = useToast();

  const handleAddInvoice = (invoice: Omit<Invoice, "id">) => {
    const newInvoice = { ...invoice, id: `inv-${Date.now()}` };
    setInvoices((prev) => [newInvoice, ...prev]);
    toast({
      title: "Success",
      description: "Invoice added successfully.",
      variant: "default",
    });
  };

  const handleUpdateInvoice = (invoice: Invoice) => {
    setInvoices((prev) =>
      prev.map((i) => (i.id === invoice.id ? invoice : i))
    );
    toast({
      title: "Success",
      description: "Invoice updated successfully.",
      variant: "default",
    });
  };

  const handleDeleteInvoice = (id: string) => {
    setInvoices((prev) => prev.filter((i) => i.id !== id));
    toast({
      title: "Invoice Deleted",
      description: "The invoice has been removed.",
      variant: "destructive",
    });
  };

  const handleOpenForm = (invoice?: Invoice) => {
    setInvoiceToEdit(invoice);
    setIsFormOpen(true);
  };

  const escapeCsvCell = (cell: any) => {
    const stringCell = String(cell ?? "");
    if (
      stringCell.includes(",") ||
      stringCell.includes('"') ||
      stringCell.includes("\n")
    ) {
      return `"${stringCell.replace(/"/g, '""')}"`;
    }
    return stringCell;
  };

  const handleDownload = () => {
    const visibleColumns = columns.filter((c) => c.isVisible);
    const header = visibleColumns.map((c) => escapeCsvCell(c.label)).join(",");
    const rows = invoices.map((invoice) =>
      visibleColumns
        .map((c) => {
          const value = invoice[c.key as keyof Invoice];
          if (value instanceof Date) {
            return escapeCsvCell(value.toLocaleDateString());
          }
          return escapeCsvCell(value);
        })
        .join(",")
    );

    const csvContent = [header, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const date = new Date().toISOString().split("T")[0];
    link.setAttribute("download", `invoices-${date}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Download Started",
      description: "Your Excel-compatible file is being downloaded.",
    });
  };

  const visibleColumns = useMemo(() => columns.filter(c => c.isVisible), [columns]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-card border-b shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <FileSpreadsheet className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold font-headline tracking-tight">
                ExcelSaver
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              <Button onClick={() => handleOpenForm()}>
                <Plus className="mr-2 h-4 w-4" /> Add Invoice
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Your Invoices</CardTitle>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={handleDownload} disabled={invoices.length === 0}>
                <Download className="mr-2 h-4 w-4" /> Download
              </Button>
              <Button variant="outline" onClick={() => setIsCustomizerOpen(true)}>
                <Settings className="mr-2 h-4 w-4" /> Customize
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <InvoiceTable
              invoices={invoices}
              columns={visibleColumns}
              onEdit={handleOpenForm}
              onDelete={handleDeleteInvoice}
            />
          </CardContent>
        </Card>
      </main>

      <InvoiceForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={invoiceToEdit ? handleUpdateInvoice : handleAddInvoice}
        invoice={invoiceToEdit}
      />

      <ColumnCustomizer
        isOpen={isCustomizerOpen}
        onClose={() => setIsCustomizerOpen(false)}
        columns={columns}
        onColumnChange={setColumns}
      />
    </div>
  );
}