import { BillingRepository } from "../../repository/billing.repository";

export class BillingLogic {
    constructor(private readonly billingRepo: BillingRepository) {}

    async getInvoices(userId: string, page = 1, limit = 20) {
        const offset = (page - 1) * limit;
        return await this.billingRepo.getInvoices(userId, limit, offset);
    }

    async getInvoiceDetails(invoiceId: string, userId: string) {
        const invoice = await this.billingRepo.getInvoiceById(invoiceId, userId);
        if (!invoice) throw new Error("INVOICE_NOT_FOUND");
        return invoice;
    }

    async getInvoicePdf(invoiceId: string, userId: string) {
        const invoice = await this.billingRepo.getInvoiceById(invoiceId, userId);
        if (!invoice) throw new Error("INVOICE_NOT_FOUND");
        
        if (invoice.pdf_url) {
            return { url: invoice.pdf_url };
        }
        
        // If no PDF URL, we might generate one or return a message
        // For now, return a placeholder or throw
        throw new Error("PDF_NOT_AVAILABLE");
    }

    async getTransactions(userId: string, page = 1, limit = 20) {
        const offset = (page - 1) * limit;
        return await this.billingRepo.getTransactions(userId, limit, offset);
    }

    async getTransactionDetails(transactionId: string, userId: string) {
        const transaction = await this.billingRepo.getTransactionById(transactionId, userId);
        if (!transaction) throw new Error("TRANSACTION_NOT_FOUND");
        return transaction;
    }
}