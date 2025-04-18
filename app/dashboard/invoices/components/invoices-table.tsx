"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Check, Clock, AlertCircle, User, Calendar, MoreHorizontal, X, Search, Filter, ChevronDown, ArrowUpDown, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { customToast } from "@/app/components/ui/custom-toast";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Invoice } from "@/app/services/invoices.service";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { InvoiceDetailDialog } from "./invoice-detail-dialog";
import { ColumnDef } from "@tanstack/react-table";

interface InvoicesTableProps {
  data: Invoice[];
  onUpdateStatus: (invoiceId: string, newStatus: string) => void;
}

const ITEMS_PER_PAGE = 10;

const getStatusColor = (status: string) => {
  switch (status) {
    case "PAGADO":
      return "bg-green-500";
    case "PENDIENTE":
      return "bg-yellow-500";
    case "ATRASADO":
      return "bg-red-500";
    case "ANULADO":
      return "bg-gray-500";
    default:
      return "bg-gray-500";
  }
};

// Process photo URL to ensure it has a proper format
const processPhotoUrl = (url: string | undefined): string | undefined => {
  if (!url) return undefined;
  
  // Trim any whitespace
  url = url.trim();
  
  // If empty string after trim, return undefined
  if (!url) return undefined;
  
  // If already starts with http, return as is
  if (url.startsWith('http')) return url;
  
  // Add https:// if missing
  return `https://${url}`;
};

const columns: ColumnDef<Invoice>[] = [
  // La columna shipping_insurance ha sido eliminada
];

export function InvoicesTable({ data, onUpdateStatus }: InvoicesTableProps) {
  const { toast: toastInstance } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [filters, setFilters] = useState({
    search: "",
    status: "TODOS",
    dateFrom: undefined as Date | undefined,
    dateTo: undefined as Date | undefined,
    amountMin: "",
    amountMax: "",
  });
  const [visibleColumns, setVisibleColumns] = useState({
    invoice_number: true,
    client: true,
    issue_date: true,
    due_date: true,
    total: true,
    status: true,
  });

  // Función para filtrar los datos
  const filteredData = data.filter(invoice => {
    const searchLower = filters.search.toLowerCase();
    const matchesSearch = 
      String(invoice.invoice_number || '').toLowerCase().includes(searchLower) ||
      (invoice.customer?.name ? invoice.customer.name.toLowerCase().includes(searchLower) : false) ||
      String(invoice.userReference || '').toLowerCase().includes(searchLower);

    const matchesStatus = filters.status === "TODOS" || !filters.status || invoice.status === filters.status;

    const matchesDateFrom = !filters.dateFrom || new Date(invoice.issue_date) >= filters.dateFrom;
    const matchesDateTo = !filters.dateTo || new Date(invoice.issue_date) <= filters.dateTo;

    const amount = parseFloat(invoice.total_amount || '0') || invoice.totalAmount || 0;
    const matchesAmountMin = !filters.amountMin || amount >= parseFloat(filters.amountMin);
    const matchesAmountMax = !filters.amountMax || amount <= parseFloat(filters.amountMax);

    return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo && 
           matchesAmountMin && matchesAmountMax;
  });

  // Paginación
  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Verificar facturas vencidas automáticamente
  useEffect(() => {
    const checkOverdueInvoices = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const overdueInvoices = data.filter(invoice => {
        const dueDate = new Date(invoice.due_date);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate < today && invoice.status !== "ATRASADO" && invoice.status !== "PAGADO";
      });

      for (const invoice of overdueInvoices) {
        try {
          await onUpdateStatus(invoice.id, "ATRASADO");
          customToast.warning({
            title: "Factura Vencida",
            description: `La factura ${invoice.invoice_number} ha sido marcada como atrasada automáticamente.`,
            action: <ToastAction altText="Ver detalles">Ver detalles</ToastAction>
          });
        } catch (error) {
          console.error("Error al actualizar factura vencida:", error);
        }
      }
    };

    checkOverdueInvoices();
    const interval = setInterval(checkOverdueInvoices, 24 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [data, onUpdateStatus]);

  const handleStatusUpdate = async (invoiceId: string, newStatus: string) => {
    try {
      if (newStatus === "ANULADO") {
        customToast.warning({
          title: "Confirmar Anulación",
          description: "¿Estás seguro de que deseas anular esta factura? Esta acción no se puede deshacer.",
          action: (
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                try {
                  await onUpdateStatus(invoiceId, "ANULADO");
                  customToast.success({
                    title: "Factura Anulada",
                    description: "La factura ha sido anulada exitosamente."
                  });
                } catch (error: any) {
                  console.error("Error al anular factura:", error);
                  customToast.error({
                    title: "Error",
                    description: error?.response?.data?.message || "No se pudo anular la factura. Por favor, intenta de nuevo."
                  });
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Confirmar Anulación
            </Button>
          ),
          duration: 10000,
        });
        return;
      }

      await onUpdateStatus(invoiceId, newStatus);
      
      const statusMessages = {
        PAGADO: {
          title: "¡Pago registrado!",
          description: "La factura ha sido marcada como pagada exitosamente.",
          action: <ToastAction altText="Ver factura">Ver factura</ToastAction>
        },
        PENDIENTE: {
          title: "Estado actualizado",
          description: "La factura ha sido marcada como pendiente.",
          action: <ToastAction altText="Ver detalles">Ver detalles</ToastAction>
        },
        ATRASADO: {
          title: "⚠️ Factura atrasada",
          description: "La factura ha sido marcada como atrasada.",
          action: <ToastAction altText="Ver detalles">Ver detalles</ToastAction>
        },
        ANULADO: {
          title: "Factura Anulada",
          description: "La factura ha sido anulada exitosamente.",
          action: <ToastAction altText="Ver detalles">Ver detalles</ToastAction>
        }
      };

      const message = statusMessages[newStatus as keyof typeof statusMessages] || {
        title: "Estado actualizado",
        description: `La factura ha sido actualizada a: ${newStatus}`
      };

      switch (newStatus) {
        case "PAGADO":
          customToast.success(message);
          break;
        case "PENDIENTE":
          customToast.warning(message);
          break;
        case "ATRASADO":
          customToast.error(message);
          break;
        case "ANULADO":
          customToast.success(message);
          break;
        default:
          customToast.info(message);
      }
    } catch (error: any) {
      customToast.error({
        title: "Error al actualizar",
        description: error?.response?.data?.message || "No se pudo actualizar el estado de la factura. Por favor, intenta de nuevo.",
        action: <ToastAction altText="Intentar de nuevo">Intentar de nuevo</ToastAction>
      });
    }
  };

  // Función para manejar el clic en una factura
  const handleInvoiceClick = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsDetailOpen(true);
  };

  return (
    <div className="w-full space-y-8">
      {/* Panel de Estadísticas */}
      <div className="relative bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Fondo decorativo */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
        
        {/* Contenido principal */}
        <div className="relative p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Facturas Pendientes */}
            <div className="relative">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-medium text-gray-500 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-yellow-500" />
                    Facturas Pendientes
                  </h3>
                  <div className="mt-3">
                    <p className="text-4xl font-bold text-gray-900">
                      {formatCurrency(filteredData
                        .filter(i => i.status === "PENDIENTE")
                        .reduce((acc, curr) => acc + (parseFloat(curr.total_amount || '0') || curr.totalAmount || 0), 0)
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm text-gray-500">
                        {filteredData.filter(i => i.status === "PENDIENTE").length} facturas
                      </span>
                      <div className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                      <span className="text-sm font-medium text-yellow-600">Pendiente</span>
                    </div>
                  </div>
                </div>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex items-center justify-center w-12 h-12 rounded-xl bg-yellow-50 text-yellow-500"
                >
                  <span className="text-2xl font-bold">
                    {filteredData.filter(i => i.status === "PENDIENTE").length}
                  </span>
                </motion.div>
              </div>
            </div>

            {/* Facturas Atrasadas */}
            <div className="relative">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-medium text-gray-500 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    Facturas Atrasadas
                  </h3>
                  <div className="mt-3">
                    <p className="text-4xl font-bold text-gray-900">
                      {formatCurrency(filteredData
                        .filter(i => i.status === "ATRASADO")
                        .reduce((acc, curr) => acc + (parseFloat(curr.total_amount || '0') || curr.totalAmount || 0), 0)
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm text-gray-500">
                        {filteredData.filter(i => i.status === "ATRASADO").length} facturas
                      </span>
                      <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                      <span className="text-sm font-medium text-red-600">Atrasado</span>
                    </div>
                  </div>
                </div>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex items-center justify-center w-12 h-12 rounded-xl bg-red-50 text-red-500"
                >
                  <span className="text-2xl font-bold">
                    {filteredData.filter(i => i.status === "ATRASADO").length}
                  </span>
                </motion.div>
              </div>
            </div>

            {/* Total Pagado */}
            <div className="relative">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-medium text-gray-500 flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-500" />
                    Total Pagado
                  </h3>
                  <div className="mt-3">
                    <p className="text-4xl font-bold text-gray-900">
                      {formatCurrency(filteredData
                        .filter(i => i.status === "PAGADO")
                        .reduce((acc, curr) => acc + (parseFloat(curr.total_amount || '0') || curr.totalAmount || 0), 0)
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm text-gray-500">
                        {filteredData.filter(i => i.status === "PAGADO").length} facturas
                      </span>
                      <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                      <span className="text-sm font-medium text-green-600">Pagado</span>
                    </div>
                  </div>
                </div>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex items-center justify-center w-12 h-12 rounded-xl bg-green-50 text-green-500"
                >
                  <span className="text-2xl font-bold">
                    {filteredData.filter(i => i.status === "PAGADO").length}
                  </span>
                </motion.div>
              </div>
            </div>
          </div>

          {/* Barra de progreso general */}
          <div className="mt-8">
            <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
              <span>Progreso de Pagos</span>
              <span>{((filteredData.filter(i => i.status === "PAGADO").length / filteredData.length) * 100).toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ 
                  width: `${(filteredData.filter(i => i.status === "PAGADO").length / filteredData.length) * 100}%` 
                }}
                transition={{ duration: 1 }}
                className="h-full bg-gradient-to-r from-green-500 to-green-600"
              />
            </div>
            <div className="flex justify-between items-center mt-4 text-xs text-gray-500">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span>Pagadas ({filteredData.filter(i => i.status === "PAGADO").length})</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span>Pendientes ({filteredData.filter(i => i.status === "PENDIENTE").length})</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span>Atrasadas ({filteredData.filter(i => i.status === "ATRASADO").length})</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-gray-500" />
                  <span>Anuladas ({filteredData.filter(i => i.status === "ANULADO").length})</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span>Total:</span>
                <span className="font-medium text-gray-900">{filteredData.length} facturas</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg border border-gray-100 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar por número de factura o cliente..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="pl-9"
              />
            </div>
            <Select
              value={filters.status}
              onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos</SelectItem>
                <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                <SelectItem value="PAGADO">Pagado</SelectItem>
                <SelectItem value="ATRASADO">Atrasado</SelectItem>
                <SelectItem value="ANULADO">Anulado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filtros Avanzados
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">Rango de Fechas</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-sm text-gray-500">Desde</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                            >
                              {filters.dateFrom ? (
                                format(filters.dateFrom, "P", { locale: es })
                              ) : (
                                <span>Seleccionar</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <CalendarComponent
                              mode="single"
                              selected={filters.dateFrom}
                              onSelect={(date) => setFilters(prev => ({ ...prev, dateFrom: date || undefined }))}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500">Hasta</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                            >
                              {filters.dateTo ? (
                                format(filters.dateTo, "P", { locale: es })
                              ) : (
                                <span>Seleccionar</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <CalendarComponent
                              mode="single"
                              selected={filters.dateTo}
                              onSelect={(date) => setFilters(prev => ({ ...prev, dateTo: date || undefined }))}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">Rango de Montos</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-sm text-gray-500">Mínimo</label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={filters.amountMin}
                          onChange={(e) => setFilters(prev => ({ ...prev, amountMin: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="text-sm text-gray-500">Máximo</label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={filters.amountMax}
                          onChange={(e) => setFilters(prev => ({ ...prev, amountMax: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => setFilters({
                      search: "",
                      status: "TODOS",
                      dateFrom: undefined,
                      dateTo: undefined,
                      amountMin: "",
                      amountMax: "",
                    })}
                  >
                    Limpiar Filtros
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <ChevronDown className="h-4 w-4" />
                  Columnas
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Columnas Visibles</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.invoice_number}
                  onCheckedChange={(checked) =>
                    setVisibleColumns(prev => ({ ...prev, invoice_number: checked }))
                  }
                >
                  Nº Factura
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.client}
                  onCheckedChange={(checked) =>
                    setVisibleColumns(prev => ({ ...prev, client: checked }))
                  }
                >
                  Cliente
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.issue_date}
                  onCheckedChange={(checked) =>
                    setVisibleColumns(prev => ({ ...prev, issue_date: checked }))
                  }
                >
                  Fecha de Emisión
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.due_date}
                  onCheckedChange={(checked) =>
                    setVisibleColumns(prev => ({ ...prev, due_date: checked }))
                  }
                >
                  Fecha de Vencimiento
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.total}
                  onCheckedChange={(checked) =>
                    setVisibleColumns(prev => ({ ...prev, total: checked }))
                  }
                >
                  Total
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.status}
                  onCheckedChange={(checked) =>
                    setVisibleColumns(prev => ({ ...prev, status: checked }))
                  }
                >
                  Estado
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Lista de facturas */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
        {/* Header de la lista */}
        <div className={cn(
          "grid gap-4 p-4 bg-gray-50 border-b border-gray-100 text-sm font-medium text-gray-500",
          {
            "grid-cols-6": Object.values(visibleColumns).filter(Boolean).length === 6,
            "grid-cols-5": Object.values(visibleColumns).filter(Boolean).length === 5,
            "grid-cols-4": Object.values(visibleColumns).filter(Boolean).length === 4,
            "grid-cols-3": Object.values(visibleColumns).filter(Boolean).length === 3,
            "grid-cols-2": Object.values(visibleColumns).filter(Boolean).length === 2,
            "grid-cols-1": Object.values(visibleColumns).filter(Boolean).length === 1
          }
        )}>
          {visibleColumns.invoice_number && <div>Nº Factura</div>}
          {visibleColumns.client && <div>Cliente</div>}
          {visibleColumns.issue_date && <div>Emisión</div>}
          {visibleColumns.due_date && <div>Vencimiento</div>}
          {visibleColumns.total && <div className="text-right">Total</div>}
          {visibleColumns.status && <div className="text-center">Estado</div>}
        </div>

        {/* Lista de facturas */}
        <div className="divide-y divide-gray-100">
          {paginatedData.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No se encontraron facturas que coincidan con los filtros.
            </div>
          ) : (
            paginatedData.map((invoice) => (
              <motion.div
                key={invoice.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={cn(
                  "group grid gap-4 p-4 items-center hover:bg-gray-50 transition-colors cursor-pointer",
                  invoice.status === "ANULADO" && "opacity-60",
                  {
                    "grid-cols-6": Object.values(visibleColumns).filter(Boolean).length === 6,
                    "grid-cols-5": Object.values(visibleColumns).filter(Boolean).length === 5,
                    "grid-cols-4": Object.values(visibleColumns).filter(Boolean).length === 4,
                    "grid-cols-3": Object.values(visibleColumns).filter(Boolean).length === 3,
                    "grid-cols-2": Object.values(visibleColumns).filter(Boolean).length === 2,
                    "grid-cols-1": Object.values(visibleColumns).filter(Boolean).length === 1
                  }
                )}
                onClick={() => handleInvoiceClick(invoice)}
              >
                {/* Número de factura y acciones */}
                {visibleColumns.invoice_number && (
                  <div className="flex items-center space-x-3">
                    <div>
                      <p className="font-medium text-gray-900">{invoice.invoice_number}</p>
                      <p className="text-xs text-gray-500">ID: {invoice.id.slice(0, 8)}</p>
                    </div>
                  </div>
                )}

                {/* Cliente */}
                {visibleColumns.client && (
                  <div className="flex items-center">
                    <Avatar className="h-8 w-8 mr-3">
                      {invoice.customer?.photo ? (
                        <AvatarImage 
                          src={processPhotoUrl(invoice.customer.photo)} 
                          alt={invoice.customer.name}
                          onError={(e) => {
                            console.log('Error loading customer image:', invoice.customer?.photo);
                            e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(invoice.customer.name || 'Cliente')}&background=random&color=fff&size=128&bold=true`;
                          }}
                        />
                      ) : (
                        <AvatarFallback className="bg-primary/10">
                          <User className="w-4 h-4 text-primary" />
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <p className="text-sm font-medium">
                      {invoice.customer ? invoice.customer.name : (invoice.userReference ? invoice.userReference.split('/').pop() : 'Sin usuario asignado')}
                    </p>
                  </div>
                )}

                {/* Fecha de emisión */}
                {visibleColumns.issue_date && (
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">{new Date(invoice.issue_date).toLocaleDateString()}</span>
                  </div>
                )}

                {/* Fecha de vencimiento */}
                {visibleColumns.due_date && (
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">{new Date(invoice.due_date).toLocaleDateString()}</span>
                    {invoice.status === "PENDIENTE" && (
                      <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">
                        {Math.ceil((new Date(invoice.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}d
                      </span>
                    )}
                  </div>
                )}

                {/* Total */}
                {visibleColumns.total && (
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(parseFloat(invoice.total_amount || '0') || invoice.totalAmount || 0)}</p>
                  </div>
                )}

                {/* Estado y acciones */}
                {visibleColumns.status && (
                  <div className="flex items-center justify-end space-x-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        "px-3 py-1",
                        getStatusColor(invoice.status),
                        "text-white"
                      )}
                    >
                      {invoice.status}
                    </Badge>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        {invoice.status !== "ANULADO" && (
                          <>
                            {invoice.status === "PAGADO" ? (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatusUpdate(invoice.id, "ANULADO");
                                }}
                                className="text-gray-600"
                              >
                                <X className="mr-2 h-4 w-4" />
                                Anular Factura
                              </DropdownMenuItem>
                            ) : (
                              <>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusUpdate(invoice.id, "PAGADO");
                                  }}
                                  className="text-green-600"
                                >
                                  <Check className="mr-2 h-4 w-4" />
                                  Marcar como Pagado
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusUpdate(invoice.id, "PENDIENTE");
                                  }}
                                  className="text-yellow-600"
                                >
                                  <Clock className="mr-2 h-4 w-4" />
                                  Marcar como Pendiente
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusUpdate(invoice.id, "ATRASADO");
                                  }}
                                  className="text-red-600"
                                >
                                  <AlertCircle className="mr-2 h-4 w-4" />
                                  Marcar como Atrasado
                                </DropdownMenuItem>
                              </>
                            )}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Paginación */}
      {filteredData.length > 0 && (
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-500">
            Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, filteredData.length)} de {filteredData.length} facturas
          </div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setCurrentPage(prev => Math.max(prev - 1, 1));
                  }}
                  aria-disabled={currentPage === 1}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <PaginationItem key={page}>
                  <PaginationLink
                    onClick={() => setCurrentPage(page)}
                    isActive={currentPage === page}
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setCurrentPage(prev => Math.min(prev + 1, totalPages));
                  }}
                  aria-disabled={currentPage === totalPages}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Diálogo de detalles de factura */}
      <InvoiceDetailDialog
        invoice={selectedInvoice}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
      />
    </div>
  );
}
