import React from "react";

// Helper to format currency
const formatMoney = (cents: number) => `S/ ${(cents / 100).toFixed(2)}`;

// Helper to trigger print
export const printComponent = (
    component: React.ReactElement,
    title = "Print Job"
) => {
    // Create a hidden iframe
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.top = "0px";
    iframe.style.left = "0px";
    iframe.style.width = "0px";
    iframe.style.height = "0px";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    // Render static HTML
    import("react-dom/server").then((ReactDOMServer) => {
        const html = ReactDOMServer.renderToStaticMarkup(component);

        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${title}</title>
                <style>
                    @page { margin: 0; size: auto; }
                    body { 
                        font-family: 'Courier New', monospace; 
                        width: 80mm; 
                        margin: 0; 
                        padding: 10px; 
                        font-size: 12px;
                        color: black;
                    }
                    * { box-sizing: border-box; }
                    .center { text-align: center; }
                    .right { text-align: right; }
                    .bold { font-weight: bold; }
                    .divider { border-top: 1px dashed black; margin: 10px 0; }
                    .row { display: flex; justify-content: space-between; }
                    .item-row { margin-bottom: 5px; }
                    .large { font-size: 16px; font-weight: bold; }
                </style>
            </head>
            <body>
                ${html}
                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(() => {
                            // Needs to be removed by parent or cleanup?? 
                            // Actually iframe removal is tricky if print dialog is open.
                            // We usually attach listener or just leave it until next reload (simple).
                            // Better: Parent manages removal or we assume simple usage.
                        }, 500);
                    }
                </script>
            </body>
            </html>
        `);
        doc.close();

        // Cleanup after print dialog closes (approximate)
        setTimeout(() => {
            document.body.removeChild(iframe);
        }, 1000 * 60); // Clean up after 1 min to be safe
    });
};

interface TicketProps {
    tenantName: string;
    address?: string;
    date: string;
    orderNumber: number;
    lines: Array<{ name: string; qty: number; total: number }>;
    subtotal: number;
    discount: number;
    total: number;
    payments?: Array<{ method: string; amount: number }>;
    clientDoc?: string;
    invoiceType?: "BOLETA" | "FACTURA" | "PRE-CUENTA";
    invoiceSeries?: string;
    invoiceNumber?: string;
    logoUrl?: string;
}

export const TicketTemplate: React.FC<TicketProps> = ({
    tenantName,
    address,
    date,
    orderNumber,
    lines,
    subtotal,
    discount,
    total,
    payments,
    clientDoc,
    invoiceType = "PRE-CUENTA",
    invoiceSeries,
    invoiceNumber,
    logoUrl = "/logo.svg",
}) => {
    return (
        <div>
            <div className="center">
                {logoUrl && (
                    <img
                        src={logoUrl}
                        alt="Logo"
                        style={{ width: '60px', height: '60px', margin: '0 auto 10px' }}
                    />
                )}
                <div className="large">{tenantName}</div>
                {address && <div>{address}</div>}
                <div className="divider" />
                <div className="bold">{invoiceType}</div>
                {invoiceSeries && invoiceNumber && (
                    <div className="large">{invoiceSeries}-{invoiceNumber}</div>
                )}
                <div>Mesa: #KEY (TODO) - Orden: #{orderNumber}</div>
                <div>Fecha: {date}</div>
            </div>

            <div className="divider" />

            <div className="item-headings row bold">
                <span style={{ flex: 1 }}>Cant. Descripcion</span>
                <span>Total</span>
            </div>

            <div className="divider" style={{ margin: "5px 0" }} />

            {lines.map((l, i) => (
                <div key={i} className="item-row">
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>{l.qty} x {l.name}</span>
                        <span>{formatMoney(l.total)}</span>
                    </div>
                </div>
            ))}

            <div className="divider" />

            <div className="row">
                <span>Subtotal:</span>
                <span>{formatMoney(subtotal)}</span>
            </div>
            {discount > 0 && (
                <div className="row">
                    <span>Descuento:</span>
                    <span>-{formatMoney(discount)}</span>
                </div>
            )}
            <div className="row large" style={{ marginTop: "5px" }}>
                <span>TOTAL:</span>
                <span>{formatMoney(total)}</span>
            </div>

            {payments && (
                <>
                    <div className="divider" />
                    <div className="bold">Pagos:</div>
                    {payments.map((p, i) => (
                        <div key={i} className="row">
                            <span>{p.method}</span>
                            <span>{formatMoney(p.amount)}</span>
                        </div>
                    ))}
                </>
            )}

            {clientDoc && (
                <>
                    <div className="divider" />
                    <div>Cliente: {clientDoc}</div>
                </>
            )}

            <div className="divider" />
            <div className="center">
                Gracias por su visita!<br />
                Vuelva pronto.
            </div>
        </div>
    );
};
