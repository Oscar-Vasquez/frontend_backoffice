"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Receipt, DollarSign, User, CheckCircle2, Clock, RefreshCw, Loader2, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { customToast } from "@/app/lib/toast";
import { UsersService } from "@/app/services/users.service";
import { InvoicesService } from "@/app/services/invoices.service";
import { toast } from "sonner";

// Hooks
import { useUserSearch } from "./hooks/useUserSearch";
import { useInvoices } from "./hooks/useInvoices";

// Components
import BillingSearch from "./components/BillingSearch";
import EmptyState from "./components/EmptyState";
import InvoiceStats from "./components/InvoiceStats";
import InvoiceFilters from "./components/InvoiceFilters";
import InvoiceList from "./components/InvoiceList";
import UserInfo from "./components/UserInfo";
import PaymentDialog from "./components/PaymentDialog";
import PendingInvoicesTable from "./components/PendingInvoicesTable";

// Types
import { InvoiceFilter, ExtendedFirebaseUser, PaymentMethod } from "./types";

export default function BillingPage() {
  // Estados para filtros
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceFilter>('todos');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);

  // Estado para rastrear si estamos viendo facturas de un cliente específico
  const [viewingUserInvoices, setViewingUserInvoices] = useState(false);

  // Usuario y búsqueda
  const { 
    searchQuery, setSearchQuery, userDetails, suggestions, 
    showSuggestions, loading, handleSearch, handleSuggestionClick, suggestionsRef, setUserDetails,
    disableAutoSuggestions
  } = useUserSearch();

  // Facturas y pagos
  const {
    invoices, stats, paymentDialog, processingPayment, pendingInvoices,
    isInvoicePaid, getInvoicesForUser, getPendingInvoices, handleOpenPaymentDialog,
    handleClosePaymentDialog, setPaymentMethod, setAmountReceived,
    handlePaymentSubmit, formatCurrency, formatDate, getCachedUser, cacheUser,
    handlePartialPaymentChange
  } = useInvoices({
    onUpdateUser: async (userId: string) => {
      try {
        await getInvoicesForUser(userId);
        customToast.success({
          title: "Facturas actualizadas",
          description: "Se han actualizado las facturas del usuario"
        });
      } catch (error) {
        console.error("Error al actualizar facturas del usuario:", error);
      }
    }
  });

  // Función para cargar o refrescar facturas pendientes
  const loadPendingInvoices = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    
    try {
      await getPendingInvoices();
      
      if (isRefresh) {
          customToast.success({
          title: "Datos actualizados",
          description: "La lista de facturas pendientes se ha actualizado"
        });
      }
    } catch (error) {
      console.error("Error al cargar facturas pendientes:", error);
      customToast.error({
        title: "Error de carga",
        description: "No se pudieron cargar las facturas pendientes"
      });
    } finally {
      if (isRefresh) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  }, []);

  // Cargar facturas pendientes solo al inicio (una vez)
  useEffect(() => {
    loadPendingInvoices();
    // Al usar un array de dependencias vacío, este efecto solo se ejecutará una vez al montar el componente
  }, []);

  // Manejar la selección de usuario
  const handleUserSelection = async (userId: string) => {
    try {
      setIsLoadingInvoices(true);
      await getInvoicesForUser(userId);
      setViewingUserInvoices(true);  // Marcar que estamos viendo facturas de un usuario
    } catch (error) {
      console.error("Error al obtener facturas:", error);
    } finally {
      setIsLoadingInvoices(false);
    }
  };

  // Función para regresar a la vista general
  const handleBackToGeneral = () => {
    setViewingUserInvoices(false);
    // Necesitamos deshabilitar las sugerencias automáticas para
    // evitar búsquedas no deseadas cuando limpiamos el campo
    disableAutoSuggestions(true);
    setSearchQuery('');
    // Limpiar los detalles del usuario para volver a la vista de facturas pendientes
    setUserDetails(null);
    
    // Después de un breve retraso, podemos volver a habilitar las sugerencias
    // automáticas para que el usuario pueda buscar nuevamente
    setTimeout(() => {
      disableAutoSuggestions(false);
    }, 500);
  };

  // Procesar la búsqueda de usuarios desde el buscador
  const processUserSearch = async () => {
    try {
      // Habilitar la búsqueda automática de sugerencias cuando el usuario
      // está usando activamente el buscador
      disableAutoSuggestions(false);
      
      const user = await handleSearch();
      if (user && user.id) {
        setIsLoadingInvoices(true);
        await handleUserSelection(user.id);
      }
    } catch (error) {
      console.error("Error en la búsqueda:", error);
    } finally {
      setIsLoadingInvoices(false);
    }
  };

  // Procesar click en sugerencia
  const processSuggestionClick = async (user: ExtendedFirebaseUser) => {
    try {
      // Habilitar la búsqueda automática de sugerencias cuando el usuario
      // está usando activamente el buscador
      disableAutoSuggestions(false);
      
      const selectedUser = await handleSuggestionClick(user);
      if (selectedUser && selectedUser.id) {
        setIsLoadingInvoices(true);
        await handleUserSelection(selectedUser.id);
      }
    } catch (error) {
      console.error("Error al seleccionar usuario:", error);
    } finally {
      setIsLoadingInvoices(false);
    }
  };

  // Manejar selección de cliente desde la tabla de facturas pendientes
  const handleClientSelection = async (client: ExtendedFirebaseUser) => {
    try {
      console.log('🔍 Cliente seleccionado de la tabla:', client);
      
      // Deshabilitar búsqueda automática de sugerencias para evitar
      // que BillingSearch reaccione al cambio de searchQuery
      disableAutoSuggestions(true);
      
      // Actualizar el término de búsqueda para reflejar el cliente seleccionado
      setSearchQuery(`${client.firstName} ${client.lastName}`);

      // Indicar que estamos cargando facturas
      setIsLoadingInvoices(true);

      // Verificar si el cliente tiene todos los datos necesarios para la vista de detalle
      const requiredFields = [
        'photo', 'planName', 'walletName', 'branchName', 'accountStatus'
      ];
      const missingFields = requiredFields.filter(field => !client[field as keyof ExtendedFirebaseUser]);
      
      let completeClient = client;
      
      // Si faltan campos importantes, intentar obtener datos completos
      if (missingFields.length > 0 || !client.subscriptionPlan || !client.branch) {
        console.log('⚠️ Faltan campos en el objeto cliente:', missingFields.join(', '));
        console.log('⚠️ subscriptionPlan:', client.subscriptionPlan);
        console.log('⚠️ branch:', client.branch);
        console.log('🔄 Intentando obtener información completa del cliente...');
        
        try {
          // Intentar obtener datos completos del usuario
          const userId = client.id || client.userId;
          if (userId) {
            const fullUserDetails = await UsersService.getUserDetails(userId);
            if (fullUserDetails) {
              console.log('✅ Se obtuvieron datos completos del usuario:', fullUserDetails);
              
              // Crear un objeto combinado que incluya toda la información necesaria
              completeClient = {
                ...client, // Mantener datos originales
                
                // Asegurar información del usuario
                id: client.id || fullUserDetails.id,
                userId: client.userId || fullUserDetails.id,
                email: client.email || fullUserDetails.email,
                firstName: client.firstName || fullUserDetails.firstName || '',
                lastName: client.lastName || fullUserDetails.lastName || '',
                
                // Datos de presentación
                photo: fullUserDetails.photo || client.photo || fullUserDetails.photoURL,
                
                // Estado de cuenta
                status: typeof fullUserDetails.status !== 'undefined' ? fullUserDetails.status : client.status,
                disabled: typeof fullUserDetails.disabled !== 'undefined' ? fullUserDetails.disabled : client.disabled,
                accountStatus: typeof fullUserDetails.accountStatus === 'boolean'
                  ? (fullUserDetails.accountStatus ? 'active' : 'inactive')
                  : (fullUserDetails.accountStatus as string || client.accountStatus || 'active'),
                
                // Información de plan
                planId: fullUserDetails.planId || client.planId,
                planName: fullUserDetails.planName || client.planName || 'Plan Estándar',
                planDescription: fullUserDetails.planDescription || client.planDescription || '',
                planRate: fullUserDetails.planRate || client.planRate || 0,
                planFrequency: fullUserDetails.planFrequency || client.planFrequency || '',
                planStatus: typeof fullUserDetails.planStatus !== 'undefined' ? fullUserDetails.planStatus : client.planStatus,
                price: fullUserDetails.price || client.price || 0,
                
                // Información de sucursal
                branchId: fullUserDetails.branchId || client.branchId,
                branchName: fullUserDetails.branchName || client.branchName || 'No asignado',
                branchAddress: fullUserDetails.branchAddress || client.branchAddress || '',
                branchProvince: fullUserDetails.branchProvince || client.branchProvince || '',
                branchPhone: fullUserDetails.branchPhone || client.branchPhone || '',
                branchZipcode: fullUserDetails.branchZipcode || client.branchZipcode || '',
                branchCity: fullUserDetails.branchCity || client.branchCity || '',
                branchLocation: fullUserDetails.branchLocation || client.branchLocation || '',
                
                // Wallet y asignaciones
                walletName: fullUserDetails.walletName || client.walletName || 'No asignado',
                assignedLocker: fullUserDetails.assignedLocker || client.assignedLocker || '',
                
                // Fechas
                birthDate: fullUserDetails.birthDate || client.birthDate,
                createdAt: fullUserDetails.createdAt || client.createdAt,
                lastLogin: fullUserDetails.lastLoginAt || fullUserDetails.lastSeen || client.lastLogin,
                
                // Mensajes
                displayMessage: fullUserDetails.displayMessage || client.displayMessage,
                
                // Verificación
                isVerified: typeof fullUserDetails.isVerified !== 'undefined' ? fullUserDetails.isVerified : client.isVerified,
                emailVerified: typeof fullUserDetails.emailVerified !== 'undefined' ? fullUserDetails.emailVerified : client.emailVerified,
                isEmailVerified: typeof fullUserDetails.isEmailVerified !== 'undefined' ? fullUserDetails.isEmailVerified : client.isEmailVerified,
              };
              
              // Crear objetos subscriptionPlan y branch explícitamente si existen en fullUserDetails
              // o usar valores predeterminados si no
              
              // Procesar objeto subscriptionPlan
              if (fullUserDetails.subscriptionPlan && typeof fullUserDetails.subscriptionPlan === 'object') {
                if ('name' in fullUserDetails.subscriptionPlan) {
                  console.log('✅ Se encontró objeto completo de subscriptionPlan');
                  completeClient.subscriptionPlan = fullUserDetails.subscriptionPlan;
                } else {
                  // Crear un objeto subscriptionPlan completo basado en la información disponible
                  console.log('⚠️ Creando objeto subscriptionPlan con la información disponible');
                  completeClient.subscriptionPlan = {
                    id: fullUserDetails.subscriptionPlan.id || fullUserDetails.planId || 'plan-default',
                    name: fullUserDetails.planName || completeClient.planName || 'Plan Estándar',
                    description: fullUserDetails.planDescription || completeClient.planDescription || '',
                    price: fullUserDetails.planRate || completeClient.planRate || 0,
                    billing_cycle: fullUserDetails.planFrequency || completeClient.planFrequency || 'Mensual',
                    color: '#E86343',
                    is_active: fullUserDetails.planStatus || completeClient.planStatus || true
                  };
                }
              } else if (completeClient.planName) {
                // Si no hay objeto subscriptionPlan pero sí hay planName, crear uno
                console.log('⚠️ Creando objeto subscriptionPlan basado en planName');
                completeClient.subscriptionPlan = {
                  id: completeClient.planId || 'plan-default',
                  name: completeClient.planName,
                  description: completeClient.planDescription || '',
                  price: completeClient.planRate || completeClient.price || 0,
                  billing_cycle: completeClient.planFrequency || 'Mensual',
                  color: '#E86343',
                  is_active: completeClient.planStatus !== false
                };
              }
              
              // Procesar objeto branch
              if (fullUserDetails.branch && typeof fullUserDetails.branch === 'object') {
                if ('name' in fullUserDetails.branch) {
                  console.log('✅ Se encontró objeto completo de branch');
                  completeClient.branch = fullUserDetails.branch;
                } else {
                  // Crear un objeto branch completo basado en la información disponible
                  console.log('⚠️ Creando objeto branch con la información disponible');
                  completeClient.branch = {
                    id: fullUserDetails.branch.id || fullUserDetails.branchId || 'branch-default',
                    name: fullUserDetails.branchName || completeClient.branchName || 'No asignado',
                    address: fullUserDetails.branchAddress || completeClient.branchAddress || '',
                    province: fullUserDetails.branchProvince || completeClient.branchProvince || '',
                    city: fullUserDetails.branchCity || completeClient.branchCity || '',
                    postal_code: fullUserDetails.branchZipcode || completeClient.branchZipcode || '',
                    phone: fullUserDetails.branchPhone || completeClient.branchPhone || '',
                    location: fullUserDetails.branchLocation || completeClient.branchLocation || ''
                  };
                }
              } else if (completeClient.branchName && completeClient.branchName !== 'No asignado') {
                // Si no hay objeto branch pero sí hay branchName, crear uno
                console.log('⚠️ Creando objeto branch basado en branchName');
                completeClient.branch = {
                  id: completeClient.branchId || 'branch-default',
                  name: completeClient.branchName,
                  address: completeClient.branchAddress || '',
                  province: completeClient.branchProvince || '',
                  city: completeClient.branchCity || '',
                  postal_code: completeClient.branchZipcode || '',
                  phone: completeClient.branchPhone || '',
                  location: completeClient.branchLocation || ''
                };
              }
              
              console.log('🔄 Cliente completo:', completeClient);
            }
          }
        } catch (error) {
          console.warn('⚠️ No se pudieron obtener datos completos del usuario:', error);
          
          // Asegurar valores predeterminados para campos críticos y crear objetos manualmente
          // si no pudimos obtenerlos del backend
          completeClient = {
            ...client,
            accountStatus: client.accountStatus || 'active',
            planName: client.planName || 'Plan Estándar',
            walletName: client.walletName || 'No asignado',
            branchName: client.branchName || 'No asignado'
          };
          
          // Crear un subscriptionPlan predeterminado si no existe
          if (!completeClient.subscriptionPlan && completeClient.planName) {
            console.log('⚠️ Creando subscriptionPlan predeterminado después del error');
            completeClient.subscriptionPlan = {
              id: completeClient.planId || 'plan-default',
              name: completeClient.planName,
              description: 'Plan de servicio estándar',
              price: completeClient.planRate || completeClient.price || 0,
              billing_cycle: completeClient.planFrequency || 'Mensual',
              color: '#E86343',
              is_active: true
            };
          }
          
          // Crear un branch predeterminado si no existe
          if (!completeClient.branch && completeClient.branchName) {
            console.log('⚠️ Creando branch predeterminado después del error');
            completeClient.branch = {
              id: completeClient.branchId || 'branch-default',
              name: completeClient.branchName,
              address: completeClient.branchAddress || '',
              province: completeClient.branchProvince || '',
              city: completeClient.branchCity || '',
              postal_code: completeClient.branchZipcode || '',
              phone: completeClient.branchPhone || '',
              location: completeClient.branchLocation || ''
            };
          }
        }
      } else {
        console.log('✅ El cliente ya tiene todos los campos necesarios');
        
        // Asegurar que tengamos objetos subscriptionPlan y branch aunque ya tengamos los campos básicos
        if (!completeClient.subscriptionPlan && completeClient.planName) {
          console.log('⚠️ Creando subscriptionPlan para cliente completo');
          completeClient.subscriptionPlan = {
            id: completeClient.planId || 'plan-default',
            name: completeClient.planName,
            description: completeClient.planDescription || 'Plan de servicio',
            price: completeClient.planRate || completeClient.price || 0,
            billing_cycle: completeClient.planFrequency || 'Mensual',
            color: '#E86343',
            is_active: completeClient.planStatus !== false
          };
        }
        
        if (!completeClient.branch && completeClient.branchName && completeClient.branchName !== 'No asignado') {
          console.log('⚠️ Creando branch para cliente completo');
          completeClient.branch = {
            id: completeClient.branchId || 'branch-default',
            name: completeClient.branchName,
            address: completeClient.branchAddress || '',
            province: completeClient.branchProvince || '',
            city: completeClient.branchCity || '',
            postal_code: completeClient.branchZipcode || '',
            phone: completeClient.branchPhone || '',
            location: completeClient.branchLocation || ''
          };
        }
      }
      
      // Guardar el cliente completado en caché para futuras referencias
      if (completeClient && completeClient.id) {
        cacheUser(completeClient);
      }
      
      // Asignar el cliente completo a userDetails
      setUserDetails(completeClient);
      
      // Obtenemos directamente las facturas del usuario usando su ID
      const userId = completeClient.id || completeClient.userId;
      if (!userId) {
        throw new Error('ID de usuario no encontrado');
      }
      
      console.log('📃 Consultando facturas directamente para el usuario:', userId);
      await getInvoicesForUser(userId);
      setViewingUserInvoices(true);
      
      // Notificar éxito
      customToast.success({
        title: "Cliente seleccionado",
        description: `Se cargaron las facturas de ${completeClient.firstName} ${completeClient.lastName}`
      });
      
    } catch (error) {
      console.error("❌ Error al seleccionar cliente desde la tabla:", error);
      customToast.error({
        title: "Error al seleccionar cliente",
        description: "Ocurrió un error al cargar los datos del cliente"
      });
      
      // En caso de error, limpiamos los estados
      setUserDetails(null);
      setViewingUserInvoices(false);
    } finally {
      // Desactivar estado de carga
      setIsLoadingInvoices(false);
      
      // Mantenemos las sugerencias deshabilitadas porque ya estamos viendo
      // las facturas del cliente o hemos vuelto a la vista general
    }
  };

  // Procesar pago desde la tabla de pendientes
  const handleProcessPaymentFromTable = (invoice: any) => {
    handleOpenPaymentDialog(invoice);
  };

  // Manejar envío de pago con actualización de tabla
  const handlePaymentSubmitWithRefresh = async () => {
    try {
      await handlePaymentSubmit();
      // Refrescar lista de facturas pendientes después de procesar un pago
      await loadPendingInvoices(true);
    } catch (error) {
      console.error("Error al procesar pago:", error);
    }
  };

  // Filtrar las facturas según el filtro seleccionado y la búsqueda
  const filteredInvoices = invoices.filter(invoice => {
    const matchesStatus = 
      invoiceFilter === 'todos' ? true :
      invoiceFilter === 'pagados' ? isInvoicePaid(invoice) :
      !isInvoicePaid(invoice);

    const matchesSearch = !invoiceSearch || 
      invoice.id.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
      invoice.description?.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
      invoice.packages.some(pkg => 
        pkg.trackingNumber.toLowerCase().includes(invoiceSearch.toLowerCase())
      );

    return matchesStatus && matchesSearch;
  });

  // Función para enviar recordatorio a un cliente
  const handleSendReminder = async (invoice: Invoice, client: ExtendedFirebaseUser) => {
    try {
      console.log('Enviando recordatorio para factura:', invoice.id);
      
      if (!invoice.id) {
        throw new Error('ID de factura no disponible');
      }
      
      // Retraso artificial para apreciar la animación (solo en desarrollo)
      if (process.env.NODE_ENV === 'development') {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      
      // Usar el servicio de facturas para enviar el recordatorio
      const result = await InvoicesService.sendInvoiceReminder(invoice.id);
      
      if (!result.success) {
        throw new Error(result.message || 'Error al enviar recordatorio');
      }
      
      // Retraso adicional para ver la animación de éxito (solo en desarrollo)
      if (process.env.NODE_ENV === 'development') {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Mostrar una notificación de éxito
      toast.success(`Recordatorio enviado a ${client.email}`, {
        description: `Se ha enviado un recordatorio sobre ${invoice.totalPackages} paquete(s) pendientes.`
      });
      
      return result;
    } catch (error) {
      console.error('Error al enviar recordatorio:', error);
      toast.error('Error al enviar recordatorio', {
        description: error instanceof Error ? error.message : 'Ha ocurrido un error inesperado'
      });
      throw error; // Re-lanzar para que pueda ser manejado por el componente
    }
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 bg-slate-50 dark:bg-slate-900 min-h-screen max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col space-y-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Gestión de Facturación</h1>
          <p className="text-sm text-muted-foreground">Administra los pagos y facturas de tus clientes</p>
        </div>
      </div>
      
      {/* Buscador - Solo se muestra cuando no hay un usuario seleccionado */}
      {!userDetails && (
        <div className="relative z-20">
          <BillingSearch
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            suggestions={suggestions}
            showSuggestions={showSuggestions}
            suggestionsRef={suggestionsRef}
            loading={loading}
            onSearch={processUserSearch}
            onSuggestionClick={processSuggestionClick}
            enableSuggestions={() => disableAutoSuggestions(false)}
          />
        </div>
      )}

      {/* Tabla de facturas pendientes */}
      {!userDetails && (
        <div className="mt-4 relative z-10">
          <div className="flex justify-between items-center mb-3">
            <div className="flex flex-col">
              <h2 className="text-lg font-medium mb-1">Facturas Pendientes</h2>
              <div className="flex items-center text-sm text-muted-foreground">
                {isLoading || isRefreshing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                    <span>{isRefreshing ? "Actualizando datos..." : "Cargando facturas pendientes..."}</span>
                  </>
                ) : pendingInvoices.length > 0 ? (
                  <>
                    <span className="font-medium text-foreground">{pendingInvoices.length}</span>
                    <span className="ml-1">facturas pendientes encontradas</span>
                  </>
                ) : (
                  "No hay facturas pendientes"
                )}
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-1.5"
              onClick={() => loadPendingInvoices(true)}
              disabled={isLoading || isRefreshing}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Actualizando...' : 'Actualizar datos'}</span>
            </Button>
          </div>
          <PendingInvoicesTable
            pendingInvoices={pendingInvoices}
            onSelectClient={handleClientSelection}
            onProcessPayment={handleProcessPaymentFromTable}
            onSendReminder={handleSendReminder}
            formatCurrency={formatCurrency}
            isLoading={isLoading || isRefreshing}
          />
        </div>
      )}

      {/* Estado vacío cuando no hay usuario seleccionado */}
      {!userDetails && !loading && pendingInvoices.length === 0 && !isLoading && (
        <div className="relative z-10">
          <EmptyState />
        </div>
      )}

        {/* Contenido del usuario */}
        {userDetails && (
        <div className="space-y-4 sm:space-y-6 relative z-10">
          <Tabs defaultValue="facturas" className="w-full">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2 sm:gap-0">
              <TabsList className="w-full sm:w-auto mb-2 sm:mb-0">
                <TabsTrigger value="facturas" className="flex items-center gap-2 flex-1 sm:flex-auto">
                  <Receipt className="h-4 w-4" />
                  <span>Facturas</span>
                </TabsTrigger>
                <TabsTrigger value="informacion" className="flex items-center gap-2 flex-1 sm:flex-auto">
                  <User className="h-4 w-4" />
                  <span>Información</span>
                </TabsTrigger>
              </TabsList>
              
              <Badge 
                variant={userDetails.isVerified ? "success" : "warning"}
                className="flex items-center gap-1 px-2.5 py-1.5 self-start sm:self-auto"
              >
                {userDetails.isVerified ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Verificado</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5" />
                    <span>Pendiente</span>
                  </>
                )}
              </Badge>
            </div>

            <TabsContent value="facturas" className="space-y-4 sm:space-y-6">
              {/* Botón para volver - Ahora está fuera del componente InvoiceList pero dentro de la pestaña de facturas */}
              <div className="flex justify-start">
                <Button 
                  onClick={handleBackToGeneral} 
                  className="flex items-center gap-2"
                  variant="outline"
                  size="sm"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Volver a facturas pendientes</span>
                </Button>
              </div>

              {/* Estadísticas */}
              <InvoiceStats 
                stats={stats} 
                formatCurrency={formatCurrency}
              />

              {/* Filtros */}
              <div className="relative z-30">
                <InvoiceFilters
                  onFilterChange={setInvoiceFilter}
                  onSearchChange={setInvoiceSearch}
                  currentFilter={invoiceFilter}
                  searchValue={invoiceSearch}
                />
              </div>

              {/* Lista de facturas */}
              <div className="relative z-20">
                <InvoiceList
                  invoices={filteredInvoices}
                  onPayInvoice={handleOpenPaymentDialog}
                  processingPayment={processingPayment}
                  isInvoicePaid={isInvoicePaid}
                  formatCurrency={formatCurrency}
                  formatDate={formatDate}
                  isFiltered={invoiceFilter !== 'todos'}
                  isSearching={!!invoiceSearch}
                  isLoading={isLoadingInvoices}
                />
              </div>
            </TabsContent>
            
            <TabsContent value="informacion">
              {/* Información del usuario */}
              <UserInfo user={userDetails} />
            </TabsContent>
          </Tabs>
          </div>
        )}

        {/* Diálogo de Pago */}
      <PaymentDialog
        paymentDialog={paymentDialog}
        onClose={handleClosePaymentDialog}
        onSubmit={handlePaymentSubmitWithRefresh}
        onPaymentMethodChange={(value) => setPaymentMethod(value as PaymentMethod)}
        onAmountReceivedChange={setAmountReceived}
        isProcessing={!!processingPayment}
        formatCurrency={formatCurrency}
        formatDate={formatDate}
        onPartialPaymentChange={handlePartialPaymentChange}
      />
    </div>
  );
}