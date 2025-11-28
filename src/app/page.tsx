
"use client";

import React, { useState, useMemo, useRef } from "react";
import {
  Download,
  FileSpreadsheet,
  Plus,
  Settings,
  ScanLine,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Invoice, ColumnConfig } from "@/lib/definitions";
import { InvoiceTable } from "@/components/invoice-table";
import { InvoiceForm } from "@/components/invoice-form";
import { ColumnCustomizer } from "@/components/column-customizer";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useMemoFirebase } from "@/firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { useCollection } from "@/firebase/firestore/use-collection";
import { extractInvoiceData } from "@/ai/flows/extract-invoice-flow";

const initialColumnsData: ColumnConfig[] = [
  { key: "invoiceId", label: "Invoice ID", isVisible: true },
  { key: "customerName", label: "Customer", isVisible: true },
  { key: "date", label: "Date", isVisible: true },
  { key: "amount", label: "Amount", isVisible: true },
  { key: "status", label: "Status", isVisible: true },
];

export default function Home() {
  const [columns, setColumns] = useState<ColumnConfig[]>(initialColumnsData);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [invoiceToEdit, setInvoiceToEdit] = useState<Invoice | undefined>(
    undefined
  );
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const invoicesCollection = useMemoFirebase(
    () => (user ? collection(firestore, "users", user.uid, "invoices") : null),
    [firestore, user]
  );
  const {
    data: invoicesData,
    isLoading: isInvoicesLoading,
    error,
  } = useCollection<Omit<Invoice, "id">>(invoicesCollection);
  
  const invoices = invoicesData || [];

  const sortedInvoices = useMemo(
    () =>
      invoices
        ? [...invoices].sort(
            (a, b) =>
              new Date(b.date).getTime() - new Date(a.date).getTime()
          )
        : [],
    [invoices]
  );

  const handleAddInvoice = async (invoice: Omit<Invoice, "id">) => {
    if (!invoicesCollection) return;
    try {
      await addDoc(invoicesCollection, invoice);
      toast({
        title: "Success",
        description: "Invoice added successfully.",
        variant: "default",
      });
    } catch (e) {
      console.error("Error adding document: ", e);
      toast({
        title: "Error",
        description: "Could not add invoice.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateInvoice = async (invoice: Invoice) => {
    if (!user) return;
    const docRef = doc(firestore, "users", user.uid, "invoices", invoice.id);
    try {
      await updateDoc(docRef, invoice);
      toast({
        title: "Success",
        description: "Invoice updated successfully.",
        variant: "default",
      });
    } catch (e) {
      console.error("Error updating document: ", e);
      toast({
        title: "Error",
        description: "Could not update invoice.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    if (!user) return;
    const docRef = doc(firestore, "users", user.uid, "invoices", id);
    try {
      await deleteDoc(docRef);
      toast({
        title: "Invoice Deleted",
        description: "The invoice has been removed.",
        variant: "destructive",
      });
    } catch (e) {
      console.error("Error deleting document: ", e);
      toast({
        title: "Error",
        description: "Could not delete invoice.",
        variant: "destructive",
      });
    }
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
    const rows = sortedInvoices.map((invoice) =>
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

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    toast({
      title: "Scanning Invoice...",
      description: "The AI is processing the image. Please wait.",
    });

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const photoDataUri = reader.result as string;
        const extractedData = await extractInvoiceData({ photoDataUri });
        
        // Map AI output to the structure expected by handleAddInvoice
        const invoiceData = {
          invoiceId: extractedData.invoiceId,
          customerName: extractedData.customerName,
          amount: extractedData.amount,
          date: new Date(extractedData.date),
          status: extractedData.status,
        };

        await handleAddInvoice(invoiceData);
        toast({
          title: "Scan Complete!",
          description: "Invoice data successfully extracted and added.",
        });
      };
      reader.onerror = (error) => {
        console.error("File reading error:", error);
        throw new Error("Failed to read file.");
      }
    } catch (e) {
      console.error("Error processing invoice image:", e);
      toast({
        variant: "destructive",
        title: "Scan Failed",
        description:
          "Could not extract data from the invoice image. Please try again.",
      });
    } finally {
      setIsScanning(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const visibleColumns = useMemo(
    () => columns.filter((c) => c.isVisible),
    [columns]
  );

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
               <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                className="hidden"
                accept="image/*"
                disabled={isScanning}
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanning}
              >
                {isScanning ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ScanLine className="mr-2 h-4 w-4" />
                )}
                Scan Invoice
              </Button>
              <Button onClick={() => handleOpenForm()} disabled={isScanning}>
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
              <Button
                variant="outline"
                onClick={handleDownload}
                disabled={invoices.length === 0 || isScanning}
              >
                <Download className="mr-2 h-4 w-4" /> Download
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsCustomizerOpen(true)}
                disabled={isScanning}
              >
                <Settings className="mr-2 h-4 w-4" /> Customize
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isUserLoading || isInvoicesLoading ? (
               <div className="flex justify-center items-center py-16">
                 <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
               </div>
            ) : (
              <InvoiceTable
                invoices={sortedInvoices}
                columns={visibleColumns}
                onEdit={handleOpenForm}
                onDelete={handleDeleteInvoice}
              />
            )}
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
