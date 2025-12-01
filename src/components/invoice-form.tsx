
"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarIcon, Loader2, Check, ChevronsUpDown } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import type { Invoice } from "@/lib/definitions";
import { invoiceSchema } from "@/lib/definitions";

type InvoiceFormProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (invoice: Omit<Invoice, "id"> | Invoice) => void;
  invoice?: Invoice;
  businessNames: string[];
};

// Helper to convert Firestore Timestamp to JS Date
const toDate = (value: Invoice['date']): Date | undefined => {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'seconds' in value) {
    return new Date((value as any).seconds * 1000);
  }
  // Fallback for unexpected formats, though it might still fail if format is truly invalid
  const parsed = new Date(value as any);
  return isNaN(parsed.getTime()) ? undefined : parsed;
}

export function InvoiceForm({
  isOpen,
  onClose,
  onSave,
  invoice,
  businessNames,
}: InvoiceFormProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  
  const form = useForm<z.infer<typeof invoiceSchema>>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      invoiceId: "",
      businessName: "",
      amount: 0,
      date: undefined,
      ...invoice,
      date: invoice ? toDate(invoice.date) : undefined,
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset(
        invoice
          ? {
              ...invoice,
              date: toDate(invoice.date),
            }
          : {
              invoiceId: "",
              businessName: "",
              amount: 0,
              date: undefined,
            }
      );
    }
  }, [invoice, isOpen, form]);

  const onSubmit = (values: z.infer<typeof invoiceSchema>) => {
    if (invoice) {
      onSave({ ...invoice, ...values });
    } else {
      onSave(values);
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{invoice ? "Edit Invoice" : "Add New Invoice"}</DialogTitle>
          <DialogDescription>
            {invoice ? "Update the details of the existing invoice." : "Fill in the details to create a new invoice."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="invoiceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice ID</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., INV-2024-004" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="businessName"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Business Name</FormLabel>
                  <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={popoverOpen}
                          className={cn(
                            "w-full justify-between",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value || "Select or create a business"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput 
                          placeholder="Search or add business..."
                          value={field.value}
                          onValueChange={(currentValue) => form.setValue("businessName", currentValue)}
                        />
                        <CommandList>
                          <CommandEmpty>No business found.</CommandEmpty>
                          <CommandGroup>
                            {businessNames.map((name) => (
                              <CommandItem
                                value={name}
                                key={name}
                                onSelect={(currentValue) => {
                                  form.setValue("businessName", currentValue === field.value ? "" : currentValue);
                                  setPopoverOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    name === field.value
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                {name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Amount</FormLabel>
                        <FormControl>
                            <Input type="number" placeholder="e.g., 1500.00" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                    <FormLabel>Invoice Date</FormLabel>
                    <Popover>
                        <PopoverTrigger asChild>
                        <FormControl>
                            <Button
                            variant={"outline"}
                            className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                            )}
                            >
                            {field.value ? (
                                format(field.value, "PPP")
                            ) : (
                                <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                                date > new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                        />
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Invoice
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
