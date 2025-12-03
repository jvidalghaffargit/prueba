
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
    businessName: z.string().describe("The name of the business or company being invoiced. This is the main recipient of the invoice."),
    cif: z.string().optional().describe("The Tax ID (CIF, NIF, or equivalent) of the business. This is a critical, high-priority field to extract if present. It might be labeled as CIF, NIF, VAT ID, or Tax ID."),
    address: z.string().optional().describe("The full physical address of the business being invoiced. This is a critical field to extract if present."),
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
  prompt: `You are an expert accountant specializing in precise data entry. Your task is to extract structured data from the provided invoice image.

Analyze the image and accurately pull out the following fields for the business being billed:
- Invoice ID (e.g., INV-2024-001). If not explicitly present, generate a plausible one.
- Business Name: The name of the company or entity receiving the invoice.
- **Business Tax ID (CIF/NIF): CRITICAL. This is a high-priority field. Find the official tax identification number. It may be labeled as 'CIF', 'NIF', 'VAT ID', or similar.**
- Business Address: The full mailing or physical address of the business.
- Total Amount: The final amount due.
- Issue Date: The date the invoice was created, formatted as YYYY-MM-DD.

Return ONLY the data in the specified JSON format. If an optional field like CIF or Address is not found, do not include it in the output.

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
