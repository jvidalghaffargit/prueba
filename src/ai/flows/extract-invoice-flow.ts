
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
    businessName: z.string().describe("The name of the business or company that ISSUED the invoice. This is the sender of the invoice."),
    cif: z.string().optional().describe("The Tax ID (CIF, NIF, or equivalent) of the business that ISSUED the invoice. This is a critical, high-priority field to extract if present."),
    address: z.string().optional().describe("The full physical address of the business that ISSUED the invoice. This is a critical field to extract if present."),
    amount: z.number().describe("The total amount due on the invoice."),
    date: z.string().describe("The date the invoice was issued, in YYYY-MM-DD format."),
    vatRate: z.number().optional().describe("The VAT (IVA) rate applied as a percentage (e.g., 21 for 21%). Return 0 if not specified or exempt."),
    vatAmount: z.number().optional().describe("The total calculated VAT (IVA) amount. Return 0 if not specified or exempt."),
});
export type ExtractInvoiceOutput = z.infer<typeof ExtractInvoiceOutputSchema>;


export async function extractInvoiceData(input: ExtractInvoiceInput): Promise<ExtractInvoiceOutput> {
  return extractInvoiceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractInvoicePrompt',
  input: {schema: ExtractInvoiceInputSchema},
  output: {schema: ExtractInvoiceOutputSchema},
  prompt: `You are an expert accountant. Your task is to extract structured data from the provided invoice image.

IMPORTANT: You must extract information about the company that SENT or ISSUED the invoice, NOT the company that received it.

Analyze the image and accurately pull out the following fields for the business that ISSUED the invoice:
- Invoice ID (e.g., INV-2024-001). If not explicitly present, generate a plausible one.
- Business Name: The name of the company or entity that created and sent the invoice.
- **Business Tax ID (CIF/NIF): CRITICAL. This is a high-priority field. Find the official tax identification number of the ISSUER. It may be labeled as 'CIF', 'NIF', 'VAT ID', or similar.**
- Business Address: The full mailing or physical address of the business that ISSUED the invoice.
- Total Amount: The final amount due.
- Issue Date: The date the invoice was created, formatted as YYYY-MM-DD.
- **VAT Rate (IVA %): The VAT percentage applied (e.g., 21, 10, 4, 0). If it's exempt or not specified, return 0.**
- **VAT Amount (IVA Cantidad): The total amount of VAT charged. If it's exempt or not specified, return 0.**

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
