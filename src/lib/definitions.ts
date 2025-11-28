import { z } from "zod";

export const invoiceSchema = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required."),
  customerName: z.string().min(1, "Customer name is required."),
  amount: z.coerce.number().positive("Amount must be a positive number."),
  date: z.date({ required_error: "Please select a date." }),
  status: z.enum(["Paid", "Pending", "Overdue"]),
});

export type Invoice = z.infer<typeof invoiceSchema> & {
  id: string;
};

export type ColumnConfig = {
  key: keyof Invoice;
  label: string;
  isVisible: boolean;
};
