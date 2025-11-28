
'use server';
/**
 * @fileOverview An AI flow for extracting structured data from invoice images.
 *
 * - extractInvoiceData - A function that handles the invoice data extraction process.
 * - ExtractInvoiceInput - The input type for the extractInvoiceData function.
 * - ExtractInvoiceOutput - The return type for the extractInvoiceData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractInvoiceInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of an invoice, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractInvoiceInput = z.infer<typeof ExtractInvoiceInputSchema>;

// This should align with the main Invoice schema, but without fields the AI can't determine (like 'id')
const ExtractInvoiceOutputSchema = z.object({
    invoiceId: z.string().describe("The unique identifier for the invoice (e.g., INV-2024-001)."),
    customerName: z.string().describe("The name of the customer or company being invoiced."),
    amount: z.number().describe("The total amount due on the invoice."),
    date: z.string().describe("The date the invoice was issued, in YYYY-MM-DD format."),
    status: z.enum(["Paid", "Pending", "Overdue"]).describe("The status of the invoice. If not specified, default to 'Pending'.")
});
export type ExtractInvoiceOutput = z.infer<typeof ExtractInvoiceOutputSchema>;


export async function extractInvoiceData(input: ExtractInvoiceInput): Promise<ExtractInvoiceOutput> {
  return extractInvoiceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractInvoicePrompt',
  input: {schema: ExtractInvoiceInputSchema},
  output: {schema: ExtractInvoiceOutputSchema},
  prompt: `You are an expert accountant specializing in data entry. Your task is to extract structured data from the provided invoice image.

Analyze the image and accurately pull out the following fields: Invoice ID, Customer Name, Total Amount, and Issue Date.

Set the status to 'Pending' unless the invoice explicitly says it is 'Paid' or is clearly past its due date, in which case set it to 'Overdue'.

Return the data in the specified JSON format.

Image: {{media url=photoDataUri}}`,
});

const extractInvoiceFlow = ai.defineFlow(
  {
    name: 'extractInvoiceFlow',
    inputSchema: ExtractInvoiceInputSchema,
    outputSchema: ExtractInvoiceOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
