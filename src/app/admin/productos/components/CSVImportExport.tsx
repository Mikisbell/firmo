'use client';

/**
 * CSV Import/Export Component
 * Componente para importar y exportar productos vía CSV
 * 
 * Features:
 * - Export CSV (download immediately)
 * - Import CSV (file picker + preview + validation)
 * - Template download
 * - Preview modal with validation errors
 * - Progress indicators
 * - Summary modal after import
 * 
 * Requirements: 3.3, 3.5, 3.6, 3.7, 3.8, 3.13, 8.5, 8.6
 * Properties: 24, 25, 26, 27, 28, 29, 43, 44
 */

import { useState, useRef } from 'react';
import {
  Download,
  Upload,
  FileText,
  Loader2,
  AlertCircle,
  Check,
  X,
  FileSpreadsheet,
} from 'lucide-react';

interface CSVImportExportProps {
  onImportComplete: () => void;
}

interface ParsedRow {
  row_number: number;
  data: {
    sku: string;
    name: string;
    short_name?: string;
    price: string;
    category: string;
    station: string;
    type: string;
    is_active: string;
  };
  errors: string[];
}

interface ImportPreview {
  valid_rows: ParsedRow[];
  invalid_rows: ParsedRow[];
  total_rows: number;
}

interface ImportResult {
  success: boolean;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  errors: Array<{ row: number; error: string }>;
}

export function CSVImportExport({ onImportComplete }: CSVImportExportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  // Export CSV
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/admin/products/export', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Error al exportar CSV');
      }

      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `productos-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      showToast('success', 'CSV exportado exitosamente');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Error al exportar CSV');
    } finally {
      setIsExporting(false);
    }
  };

  // Download template
  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('/api/admin/products/template', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Error al descargar plantilla');
      }

      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'plantilla-productos.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      showToast('success', 'Plantilla descargada exitosamente');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Error al descargar plantilla');
    }
  };

  // Handle file selection
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      showToast('error', 'Por favor selecciona un archivo CSV');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      showToast('error', 'El archivo es demasiado grande (máximo 5MB)');
      return;
    }

    setSelectedFile(file);
    await previewImport(file);
  };

  // Preview import
  const previewImport = async (file: File) => {
    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('preview', 'true');

      const response = await fetch('/api/admin/products/import', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Error al procesar CSV');
      }

      setImportPreview(result.preview);
      setShowPreviewModal(true);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Error al procesar CSV');
      setSelectedFile(null);
    } finally {
      setIsImporting(false);
    }
  };

  // Execute import
  const executeImport = async () => {
    if (!selectedFile) return;

    setIsImporting(true);
    setShowPreviewModal(false);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/admin/products/import', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok && response.status !== 207) {
        throw new Error(result.error?.message || 'Error al importar CSV');
      }

      setImportResult(result);
      setShowSummaryModal(true);
      onImportComplete();
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Error al importar CSV');
    } finally {
      setIsImporting(false);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Export Button */}
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50 min-h-[44px]"
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">Exportar CSV</span>
          <span className="sm:hidden">Exportar</span>
        </button>

        {/* Import Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors disabled:opacity-50 min-h-[44px]"
        >
          {isImporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">Importar CSV</span>
          <span className="sm:hidden">Importar</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Template Button */}
        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors min-h-[44px]"
        >
          <FileText className="w-4 h-4" />
          <span className="hidden sm:inline">Descargar Plantilla</span>
          <span className="sm:hidden">Plantilla</span>
        </button>
      </div>

      {/* Preview Modal */}
      {showPreviewModal && importPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-zinc-800 flex-shrink-0">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-6 h-6 text-amber-500" />
                <div>
                  <h3 className="text-lg font-semibold">Vista Previa de Importación</h3>
                  <p className="text-sm text-zinc-400 mt-1">
                    {importPreview.total_rows} filas encontradas
                  </p>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="p-4 border-b border-zinc-800 flex-shrink-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-green-400">
                    <Check className="w-4 h-4" />
                    <span className="text-sm font-medium">Filas válidas</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{importPreview.valid_rows.length}</p>
                </div>
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-red-400">
                    <X className="w-4 h-4" />
                    <span className="text-sm font-medium">Filas con errores</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{importPreview.invalid_rows.length}</p>
                </div>
              </div>
            </div>

            {/* Rows Table */}
            <div className="flex-1 overflow-auto p-4">
              {importPreview.invalid_rows.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-red-400 mb-2">Filas con Errores</h4>
                  <div className="space-y-2">
                    {importPreview.invalid_rows.slice(0, 10).map((row) => (
                      <div
                        key={row.row_number}
                        className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-xs font-mono text-zinc-400">
                            Fila {row.row_number}
                          </span>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{row.data.name || row.data.sku}</p>
                            <ul className="mt-1 space-y-1">
                              {row.errors.map((error, i) => (
                                <li key={i} className="text-xs text-red-400">
                                  • {error}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ))}
                    {importPreview.invalid_rows.length > 10 && (
                      <p className="text-xs text-zinc-400 text-center">
                        ... y {importPreview.invalid_rows.length - 10} errores más
                      </p>
                    )}
                  </div>
                </div>
              )}

              {importPreview.valid_rows.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-green-400 mb-2">
                    Filas Válidas (primeras 10)
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-800">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-zinc-400">
                            Fila
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-zinc-400">
                            SKU
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-zinc-400">
                            Nombre
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-zinc-400">
                            Precio
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-zinc-400">
                            Categoría
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800">
                        {importPreview.valid_rows.slice(0, 10).map((row) => (
                          <tr key={row.row_number} className="hover:bg-zinc-800/50">
                            <td className="px-3 py-2 text-xs text-zinc-400">
                              {row.row_number}
                            </td>
                            <td className="px-3 py-2 font-mono text-xs">{row.data.sku}</td>
                            <td className="px-3 py-2">{row.data.name}</td>
                            <td className="px-3 py-2">{row.data.price}</td>
                            <td className="px-3 py-2">{row.data.category}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {importPreview.valid_rows.length > 10 && (
                      <p className="text-xs text-zinc-400 text-center mt-2">
                        ... y {importPreview.valid_rows.length - 10} filas más
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-zinc-800 flex gap-2 flex-shrink-0">
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  setSelectedFile(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
                disabled={isImporting}
                className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={executeImport}
                disabled={isImporting || importPreview.valid_rows.length === 0}
                className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {isImporting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importando...
                  </span>
                ) : (
                  `Importar ${importPreview.valid_rows.length} productos`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary Modal */}
      {showSummaryModal && importResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 w-full max-w-md">
            {/* Header */}
            <div className="p-4 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                {importResult.success ? (
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <Check className="w-5 h-5 text-green-400" />
                  </div>
                ) : (
                  <div className="p-2 bg-amber-500/20 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-amber-400" />
                  </div>
                )}
                <h3 className="text-lg font-semibold">Importación Completada</h3>
              </div>
            </div>

            {/* Summary */}
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <span className="text-sm text-zinc-300">Productos creados</span>
                <span className="text-lg font-bold text-green-400">
                  {importResult.created_count}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <span className="text-sm text-zinc-300">Productos actualizados</span>
                <span className="text-lg font-bold text-blue-400">
                  {importResult.updated_count}
                </span>
              </div>
              {importResult.skipped_count > 0 && (
                <div className="flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <span className="text-sm text-zinc-300">Filas omitidas</span>
                  <span className="text-lg font-bold text-amber-400">
                    {importResult.skipped_count}
                  </span>
                </div>
              )}
              {importResult.errors.length > 0 && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-sm font-medium text-red-400 mb-2">
                    Errores ({importResult.errors.length})
                  </p>
                  <ul className="space-y-1 max-h-32 overflow-y-auto">
                    {importResult.errors.slice(0, 5).map((err, i) => (
                      <li key={i} className="text-xs text-red-400">
                        Fila {err.row}: {err.error}
                      </li>
                    ))}
                    {importResult.errors.length > 5 && (
                      <li className="text-xs text-zinc-400">
                        ... y {importResult.errors.length - 5} errores más
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-zinc-800">
              <button
                onClick={() => {
                  setShowSummaryModal(false);
                  setImportResult(null);
                }}
                className="w-full px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-[70] animate-in slide-in-from-top-2">
          <div
            className={`px-4 py-3 rounded-lg shadow-lg border ${
              toast.type === 'success'
                ? 'bg-green-500/20 border-green-500/30 text-green-400'
                : 'bg-red-500/20 border-red-500/30 text-red-400'
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'success' ? (
                <Check className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              <span className="text-sm font-medium">{toast.message}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
