
"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Download,
  FileSpreadsheet,
  Plus,
  Settings,
  ScanLine,
  Loader2,
  Calendar as CalendarIcon,
  X as XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import type { Invoice, ColumnConfig } from "@/lib/definitions";
import { InvoiceTable } from "@/components/invoice-table";
import { InvoiceForm } from "@/components/invoice-form";
import { ColumnCustomizer } from "@/components/column-customizer";
import { useToast } from "@/hooks/use-toast";
import { useUser, useAuth, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, addDoc, serverTimestamp, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { extractInvoiceData } from "@/ai/flows/extract-invoice-flow";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfDay, endOfDay } from "date-fns";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import * as pdfjs from 'pdfjs-dist';
import { useRouter } from "next/navigation";

// Set worker source for pdf.js
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const initialColumnsData: ColumnConfig[] = [
  { key: "invoiceId", label: "Invoice ID", isVisible: true },
  { key: "businessName", label: "Business", isVisible: true },
  { key: "date", label: "Date", isVisible: true },
  { key: "amount", label: "Amount", isVisible: true },
  { key: "cif", label: "CIF", isVisible: false },
  { key: "address", label: "Address", isVisible: false },
  { key: "concept", label: "Concept", isVisible: false },
  { key: "vatRate", label: "VAT Rate", isVisible: false },
  { key: "vatAmount", label: "VAT Amount", isVisible: false },
];

const ITEMS_PER_PAGE = 10;

export default function Home() {
  const [columns, setColumns] = useState<ColumnConfig[]>(initialColumnsData);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [invoiceToEdit, setInvoiceToEdit] = useState<Invoice | undefined>(
    undefined
  );
  const [isScanning, setIsScanning] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);

  const { toast } = useToast();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();


  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

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


  const filteredAndSortedInvoices = useMemo(() => {
    if (!invoices) return [];
    
    let filtered = [...invoices];

    // Search term filter
    if (searchTerm) {
        const lowercasedTerm = searchTerm.toLowerCase();
        filtered = filtered.filter(invoice => 
            invoice.businessName.toLowerCase().includes(lowercasedTerm) ||
            invoice.invoiceId.toLowerCase().includes(lowercasedTerm)
        );
    }

    // Date range filter
    if (dateRange?.from) {
        const fromDate = startOfDay(dateRange.from);
        const toDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
        
        filtered = filtered.filter(invoice => {
            const invoiceDate = invoice.date instanceof Date ? invoice.date : new Date((invoice.date as any).seconds * 1000);
            return invoiceDate >= fromDate && invoiceDate <= toDate;
        });
    }

    // Sort by date descending
    return filtered.sort(
          (a, b) => {
              const dateA = a.date instanceof Date ? a.date.getTime() : new Date((a.date as any).seconds * 1000).getTime();
              const dateB = b.date instanceof Date ? b.date.getTime() : new Date((b.date as any).seconds * 1000).getTime();
              return dateB - dateA;
          }
        );
  }, [invoices, searchTerm, dateRange]);

  const businessNames = useMemo(() => {
    if (!invoices) return [];
    const names = invoices.map(invoice => invoice.businessName);
    return [...new Set(names)];
  }, [invoices]);
  
  // Reset to first page whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateRange]);

  const totalPages = Math.ceil(filteredAndSortedInvoices.length / ITEMS_PER_PAGE);

  const paginatedInvoices = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredAndSortedInvoices.slice(startIndex, endIndex);
  }, [filteredAndSortedInvoices, currentPage]);

  const resetFilters = () => {
    setSearchTerm("");
    setDateRange(undefined);
  };
  
  const areFiltersActive = searchTerm || dateRange;

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
    if (!user || !firestore) return;
    try {
      const docRef = doc(firestore, 'invoices', invoice.id);
      await setDoc(docRef, invoice, { merge: true });
      toast({
        title: "Success",
        description: "Invoice updated successfully.",
        variant: "default",
      });
    } catch (e) {
      console.error("Error updating invoice: ", e);
      toast({
        title: "Error",
        description: "Could not update invoice.",
        variant: "destructive",
      });
    }
  };

  const confirmDeleteInvoice = (invoice: Invoice) => {
    setInvoiceToDelete(invoice);
  };

  const handleDeleteInvoice = async () => {
    if (!user || !firestore || !invoiceToDelete) return;
    try {
      const docRef = doc(firestore, "invoices", invoiceToDelete.id);
      await deleteDoc(docRef);
      toast({
        title: "Success",
        description: `Invoice ${invoiceToDelete.invoiceId} deleted successfully.`,
        variant: "default",
      });
    } catch (e) {
      console.error("Error deleting invoice: ", e);
      toast({
        title: "Error",
        description: "Could not delete invoice.",
        variant: "destructive",
      });
    } finally {
      setInvoiceToDelete(null);
    }
  };

  const handleOpenForm = (invoice?: Invoice) => {
    setInvoiceToEdit(invoice);
    setIsFormOpen(true);
  };

  const escapeCsvCell = (cell: any) => {
    if (cell === null || cell === undefined) {
        return "";
    }
    
    let stringCell = String(cell);

    if (typeof cell === 'number') {
        stringCell = stringCell.replace('.', ',');
    }
    
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
    const rows = filteredAndSortedInvoices.map((invoice) =>
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
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
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

  const handleFileScan = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setIsScanning(true);
    toast({
      title: "Scanning Invoice...",
      description: "The AI is processing the file. Please wait.",
    });

    try {
      let fileDataUri: string;
      if (file.type === "application/pdf") {
          const pdfAsArrayBuffer = await file.arrayBuffer();
          const pdfDoc = await pdfjs.getDocument({data: pdfAsArrayBuffer}).promise;
          const page = await pdfDoc.getPage(1);
          const viewport = page.getViewport({ scale: 1.5 });
          
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          if (!context) {
            throw new Error('Could not get canvas context');
          }

          await page.render({ canvasContext: context, viewport: viewport }).promise;
          fileDataUri = canvas.toDataURL('image/png');
      } else {
        fileDataUri = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (error) => reject(error);
        });
      }
      
      const extractedData = await extractInvoiceData({ fileDataUri });
      
      const newInvoice: Omit<Invoice, "id" | "userId"> = {
        invoiceId: extractedData.invoiceId,
        businessName: extractedData.businessName,
        amount: extractedData.amount,
        date: new Date(extractedData.date),
        cif: extractedData.cif,
        address: extractedData.address,
        concept: "Scanned Invoice",
        vatRate: 21,
        vatAmount: extractedData.amount * 0.21,
      };

      await handleAddInvoice(newInvoice);
      
      toast({
        title: "Scan Complete!",
        description: "Invoice data successfully extracted and saved.",
      });
    } catch (e) {
      console.error("Error processing invoice file:", e);
      toast({
        variant: "destructive",
        title: "Scan Failed",
        description:
          "Could not extract data from the invoice file. Please try again.",
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

  if (isUserLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-card border-b shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <FileSpreadsheet className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold font-headline tracking-tight">
                Business Invoices
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground hidden sm:inline">{user.email}</span>
               <Button variant="outline" onClick={() => auth.signOut()}>Logout</Button>
               <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileScan}
                className="hidden"
                accept="image/*,application/pdf"
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
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
              <CardTitle>Your Invoices</CardTitle>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                <Input
                  placeholder="Search by business or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-48 md:w-64"
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="date"
                      variant={"outline"}
                      className={cn(
                        "w-full sm:w-[260px] justify-start text-left font-normal",
                        !dateRange && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "LLL dd, y")} -{" "}
                            {format(dateRange.to, "LLL dd, y")}
                          </>
                        ) : (
                          format(dateRange.from, "LLL dd, y")
                        )
                      ) : (
                        <span>Pick a date range</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
                {areFiltersActive && (
                  <Button variant="ghost" onClick={resetFilters} className="w-full sm:w-auto">
                    <XIcon className="mr-2 h-4 w-4" />
                    Reset
                  </Button>
                )}
              </div>
            </div>
            <div className="flex flex-row items-center justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={handleDownload}
                disabled={!filteredAndSortedInvoices || filteredAndSortedInvoices.length === 0 || isScanning}
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
                invoices={paginatedInvoices}
                columns={visibleColumns}
                onEdit={handleOpenForm}
                onDelete={confirmDeleteInvoice}
              />
            )}
          </CardContent>
          {totalPages > 1 && (
            <CardFooter>
              <div className="text-xs text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center space-x-2 ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </CardFooter>
          )}
        </Card>
      </main>

      <InvoiceForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={invoiceToEdit ? handleUpdateInvoice : handleAddInvoice}
        invoice={invoiceToEdit}
        businessNames={businessNames}
      />

      <ColumnCustomizer
        isOpen={isCustomizerOpen}
        onClose={() => setIsCustomizerOpen(false)}
        columns={columns}
        onColumnChange={setColumns}
      />
      
      <AlertDialog open={!!invoiceToDelete} onOpenChange={(open) => !open && setInvoiceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the invoice{" "}
              <span className="font-bold">{invoiceToDelete?.invoiceId}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setInvoiceToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteInvoice}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
