import { z } from "zod";

// This is the Zod schema for validating form input.
// Note that the `date` is a `Date` object here.
export const invoiceSchema = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required."),
  businessName: z.string().min(1, "Business name is required."),
  amount: z.coerce.number().positive("Amount must be a positive number."),
  date: z.date({ required_error: "Please select a date." }),
});

// This is the TypeScript type for an invoice as it is stored in Firestore.
// It includes the document ID and the owner's user ID.
// The `date` can be a Firestore Timestamp object or a string after being fetched.
export type Invoice = {
  id: string;
  userId: string;
  invoiceId: string;
  businessName: string;
  amount: number;
  date: Date | { seconds: number; nanoseconds: number };
};


export type ColumnConfig = {
  key: keyof Invoice | 'actions';
  label: string;
  isVisible: boolean;
};
