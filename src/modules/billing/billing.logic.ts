export class BillingLogic {
    async getInvoices() {
        return { msg: "Get invoices" };
    }

    async getInvoiceDetails(invoiceId: string) {
        return { msg: "Get invoice details" };
    }

    async getInvoicePdf(invoiceId: string) {
        return { msg: "Get invoice PDF" };
    }

    async getTransactions() {
        return { msg: "Get transactions" };
    }

    async getTransactionDetails(transactionId: string) {
        return { msg: "Get transaction details" };
    }
}
