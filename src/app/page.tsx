
"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
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
import { useUser, initiateAnonymousSignIn, useAuth, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { extractInvoiceData } from "@/ai/flows/extract-invoice-flow";

const initialColumnsData: ColumnConfig[] = [
  { key: "invoiceId", label: "Invoice ID", isVisible: true },
  { key: "restaurantName", label: "Restaurant", isVisible: true },
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
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();

  useEffect(() => {
    if (!isUserLoading && !user) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  const invoicesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, "invoices"), where("userId", "==", user.uid));
  }, [firestore, user]);

  const { data: invoices, isLoading: isInvoicesLoading, error: invoicesError } = useCollection<Invoice>(invoicesQuery);

   useEffect(() => {
    if (invoicesError) {
      console.error(invoicesError);
      toast({
        title: "Error",
        description: "Could not fetch invoices.",
        variant: "destructive",
      });
    }
  }, [invoicesError, toast]);


  const sortedInvoices = useMemo(() => {
    if (!invoices) return [];
    return [...invoices].sort(
          (a, b) => {
              const dateA = a.date instanceof Date ? a.date.getTime() : new Date((a.date as any).seconds * 1000).getTime();
              const dateB = b.date instanceof Date ? b.date.getTime() : new Date((b.date as any).seconds * 1000).getTime();
              return dateB - dateA;
          }
        );
  }, [invoices]);

  const handleAddInvoice = async (invoice: Omit<Invoice, "id" | "userId">) => {
    if (!user || !firestore) return;
    try {
      const collectionRef = collection(firestore, 'invoices');
      await addDoc(collectionRef, {
        ...invoice,
        userId: user.uid,
        createdAt: serverTimestamp(),
      });
      
      toast({
        title: "Success",
        description: "Invoice added successfully.",
        variant: "default",
      });
    } catch (e) {
      console.error("Error adding invoice: ", e);
      toast({
        title: "Error",
        description: "Could not add invoice.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateInvoice = async (invoice: Invoice) => {
    // This would require a PUT/PATCH endpoint in the API
    console.warn("Update functionality not implemented in API route yet.");
    toast({
        title: "Pending Feature",
        description: "Updating invoices is not yet supported in this version.",
      });
  };

  const handleDeleteInvoice = async (id: string) => {
     // This would require a DELETE endpoint in the API
     console.warn("Delete functionality not implemented in API route yet.");
     toast({
        title: "Pending Feature",
        description: "Deleting invoices is not yet supported in this version.",
      });
  };

  const handleOpenForm = (invoice?: Invoice) => {
    setInvoiceToEdit(invoice);
    setIsFormOpen(true);
  };

  const escapeCsvCell = (cell: any) => {
    if (cell === null || cell === undefined) {
        return "";
    }
    const stringCell = String(cell);
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
          if (value && typeof value === 'object' && 'seconds' in value) {
            return escapeCsvCell(new Date((value as any).seconds * 1000).toLocaleDateString());
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
    if (!file || !user) return;

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
        
        const newInvoice: Omit<Invoice, "id" | "userId"> = {
          invoiceId: extractedData.invoiceId,
          restaurantName: extractedData.restaurantName,
          amount: extractedData.amount,
          date: new Date(extractedData.date),
          status: extractedData.status,
        };

        await handleAddInvoice(newInvoice);
        
        toast({
          title: "Scan Complete!",
          description: "Invoice data successfully extracted and saved.",
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
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const visibleColumns = useMemo(
    () => columns.filter((c) => c.isVisible),
    [columns]
  );
  
  const isLoading = isUserLoading || isInvoicesLoading;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-card border-b shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <FileSpreadsheet className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold font-headline tracking-tight">
                Restaurant Invoices
              </h1>
            </div>
            <div className="flex items-center space-x-2">
               <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                className="hidden"
                accept="image/*"
                disabled={isScanning || !user}
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanning || !user}
              >
                {isScanning ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ScanLine className="mr-2 h-4 w-4" />
                )}
                Scan Invoice
              </Button>
              <Button onClick={() => handleOpenForm()} disabled={isScanning || !user}>
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
                disabled={!invoices || invoices.length === 0 || isScanning}
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
            {isLoading ? (
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
