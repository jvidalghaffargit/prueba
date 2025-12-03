
'use server';
/**
 * @fileOverview An AI flow for extracting structured data from invoice images or PDFs.
 *
 * - extractInvoiceData - A function that handles the invoice data extraction process.
 * - ExtractInvoiceInput - The input type for the extractInvoiceData function.
 * - ExtractInvoiceOutput - The return type for the extractInvoiceData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractInvoiceInputSchema = z.object({
  fileDataUri: z
    .string()
    .describe(
      "An image of an invoice (or a document page), as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractInvoiceInput = z.infer<typeof ExtractInvoiceInputSchema>;

// This should align with the main Invoice schema, but without fields the AI can't determine (like 'id')
const ExtractInvoiceOutputSchema = z.object({
    invoiceId: z.string().describe("The unique identifier for the invoice (e.g., INV-2024-001). If not found, generate a plausible one."),
    businessName: z.string().describe("The name of the business or company being invoiced."),
    cif: z.string().optional().describe("The tax ID (CIF/NIF) of the business, if present."),
    address: z.string().optional().describe("The physical address of the business being invoiced. This is a critical field to extract if present."),
    amount: z.number().describe("The total amount due on the invoice."),
    date: z.string().describe("The date the invoice was issued, in YYYY-MM-DD format."),
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

Analyze the image and accurately pull out the following fields: Invoice ID, Business Name, Business Tax ID (CIF/NIF), Business Address, Total Amount, and Issue Date. Pay special attention to extracting the full Business Address.

If an Invoice ID is not explicitly present on the invoice, you must generate a plausible one (e.g., INV- followed by a sequence of numbers).

Return the data in the specified JSON format.

Image: {{media url=fileDataUri}}`,
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
