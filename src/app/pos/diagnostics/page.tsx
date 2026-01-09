// src/app/pos/diagnostics/page.tsx
import DiagnosticsClient from "./DiagnosticsClient";

export default function DiagnosticsPage() {
    return (
        <div style={{ padding: 16 }}>
            <h1>Diagnostics</h1>
            <DiagnosticsClient />
        </div>
    );
}
