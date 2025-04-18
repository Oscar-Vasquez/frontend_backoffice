"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Receipt, Calculator, Filter, RefreshCw, Loader2, PlusCircle, Calendar, ArrowDownUp, Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { customToast } from "@/app/lib/toast";

// Hooks
import { useTransactions } from "./hooks/useTransactions";
import { useCategoryFilters } from "./hooks/useCategoryFilters";

// Components
import ExpenseStats from "./components/ExpenseStats";
import ExpenseFilters from "./components/ExpenseFilters";
import ExpenseList from "./components/ExpenseList";
import EmptyState from "./components/EmptyState";
import NewExpenseDialog from "./components/NewExpenseDialog";
import ExpenseCategoriesChart from "./components/ExpenseCategoriesChart";

// Types
import { TransactionFilter, SortOrder, TransactionType } from "./types";

export default function ExpensesPage() {
  // ID de la categoría "Gastos" que queremos cargar
  const gastosCategoryId = "abf8bc37-4a67-4c1c-91aa-1eb41b848a0c";
  
  // Estados para manejar los filtros
  const [expenseSearch, setExpenseSearch] = useState("");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [newExpenseOpen, setNewExpenseOpen] = useState(false);
  
  // Usar categorías
  const { 
    categories, 
    selectedCategories, 
    toggleCategory, 
    resetCategories, 
    isLoadingCategories 
  } = useCategoryFilters({ transactionType: 'gasto' });

  // Usar transacciones con la categoría específica sin filtrar por tipo de transacción
  const {
    filteredTransactions,
    stats,
    isLoading: isLoadingTransactions,
    filterTransactions,
    getTransactions,
    createTransaction,
  } = useTransactions({ 
    initialFilter: "todos", 
    categoryId: gastosCategoryId
    // No incluir transactionType para ver todas las transacciones de la categoría
  });

  // Handler para crear un nuevo gasto
  const handleCreateExpense = async (formData: any) => {
    console.log("🏁 Iniciando creación de gasto con datos:", formData);
    console.log("📊 Categoría seleccionada:", formData.categoryId);
    console.log("💰 Método de pago seleccionado:", formData.paymentMethod);
    
    try {
      const transactionData = {
        ...formData,
        transactionType: "payment",  // Usar "payment" para transactionType
        status: "completed",          // Estado completado por defecto
        entityType: "users",          // Tipo de entidad válido: "users"
        entityId: "a88be672-8af2-4f68-a917-d851cebbbec6"  // UUID válido para el usuario actual
      };
      
      console.log("📤 Datos finales para crear transacción:", transactionData);
      
      // Esperar a que se complete la creación de la transacción
      await createTransaction(transactionData);

      // Esperar a que se recarguen los datos después de crear la transacción
      await getTransactions(); 
      
      // Cerrar el modal solo después de que todo el proceso haya finalizado
      setNewExpenseOpen(false);
      
      customToast.success({
        title: "Gasto creado",
        description: "El gasto se ha registrado correctamente"
      });
    } catch (error) {
      console.error("Error al crear el gasto:", error);
      customToast.error({
        title: "Error",
        description: "No se pudo registrar el gasto"
      });
    }
  };

  // Aplicar filtros cuando cambian
  useEffect(() => {
    filterTransactions("todos", expenseSearch, dateRange, selectedCategories);
  }, [expenseSearch, dateRange, selectedCategories, filterTransactions]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Gastos</h2>
          <p className="text-muted-foreground">
            Gestiona los gastos de tu negocio de manera eficiente
          </p>
        </div>
        <Button onClick={() => setNewExpenseOpen(true)} className="w-full md:w-auto">
          <Plus className="mr-2 h-4 w-4" /> Registrar Gasto
        </Button>
      </div>

      <ExpenseStats stats={stats} isLoading={isLoadingTransactions} />

      <ExpenseFilters
        expenseFilter="todos"
        setExpenseFilter={(filter) => filterTransactions(filter, expenseSearch, dateRange, selectedCategories)}
        expenseSearch={expenseSearch}
        setExpenseSearch={setExpenseSearch}
        dateRange={dateRange}
        setDateRange={setDateRange}
        categories={categories}
        selectedCategories={selectedCategories}
        toggleCategory={toggleCategory}
        resetCategories={resetCategories}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
      />

      {isLoadingTransactions ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
        </div>
      ) : filteredTransactions.length === 0 ? (
        <EmptyState 
          title="No hay gastos registrados" 
          description="Comienza a registrar tus gastos para visualizarlos aquí"
          actionLabel="Registrar Gasto"
          onAction={() => setNewExpenseOpen(true)}
        />
      ) : (
        <ExpenseList 
          expenses={filteredTransactions} 
          sortOrder={sortOrder}
        />
      )}

      <NewExpenseDialog
        open={newExpenseOpen}
        onOpenChange={setNewExpenseOpen}
        onCreateExpense={handleCreateExpense}
        categories={categories.filter(cat => {
          console.log("🧩 Filtrando categoría para NewExpenseDialog:", cat.name, "tipo:", cat.transactionType);
          return cat.transactionType === 'gasto';
        })}
        isCreating={isLoadingTransactions}
      />
    </div>
  );
} 