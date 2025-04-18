'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { 
  Search, 
  PackageCheck,
  AlertCircle,
  Loader2,
  Package,
  PackageOpen,
  ChevronRight,
  X,
  Users,
  ScanBarcode,
  Truck,
  UserPlus,
  Receipt,
  MoreHorizontal,
  FileText,
  DollarSign,
  MapPin,
  Calendar,
  Loader,
  Info,
  CheckCircle2,
  Clock,
  PackageIcon,
  Mail,
  CreditCard,
  Building,
  Trash2,
  User,
  ArrowLeft,
  UserX2,
  BadgeCheck,
  FileCheck2,
  ReceiptText,
  ArrowRight,
  Eye,
  Check,
  ChevronLeft,
  HelpCircle,
  Filter,
  UserCog,
  LifeBuoy,
  BookOpen,
  MessageSquare,
  ThumbsUp,
  Timer,
  Shield,
  BarChart
} from "lucide-react";

import { motion, AnimatePresence } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { cn } from "@/lib/utils";
import { TrackingInfo, DirectTrackingService } from '../services/directTrackingService';
import { useInvoice } from '@/app/contexts/InvoiceContext';
import { packagesService, PackagesService } from '@/app/services/packages.service';
import useThemeSettingsStore from '@/store/themeSettingsStore';
import { StatusBadge } from './StatusBadge';
import AdvancedScanningEffect from './AdvancedScanningEffect';
import { PackageDetailView } from './package-detail/PackageDetailView';
import { PackageResultCard } from './PackageResultCard';
import { ClientAssignmentDialog } from './ClientAssignmentDialog';
import SearchBar from './SearchBar';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { StatsService, PackageStats } from '../services/statsService';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { UsersService } from "@/app/services/users.service";
import { AuthService } from '@/app/services/auth.service';

// Interfaz para el modelo de cliente
interface Client {
  id: string;
  name: string;
  email: string;
  planRate: number;
  photo?: string;
  planName?: string;
  branchName?: string;
  shipping_insurance?: boolean;
  subscriptionDetails?: {
    planName: string;
    price?: string;
  };
}

// Tipos para la gestión de facturación
interface InvoicePackage {
  id: string;
  trackingNumber: string;
  weight: number;
  price: number;
  clientId: string;
  clientName: string;
}

interface InvoiceGroup {
  clientId: string;
  clientName: string;
  planRate: number;
  packages: InvoicePackage[];
  total: number;
  clientPhoto?: string;
  clientEmail?: string;
  planName?: string;
  branchName?: string;
}

// Extendemos TrackingInfo para incluir los campos adicionales del cliente
interface ExtendedTrackingInfo extends TrackingInfo {
  isInvoiced?: boolean;
  invoiceDetails?: {
    invoice_number: string;
    [key: string]: any;
  };
  status?: string;
  status_name?: string;
  client?: Client;
  estimatedDeliveryDate?: string;
  lastUpdated?: string;
  notes?: string;
}

// Tipo para manejar tanto clientes como resultados de tracking
interface SelectableItem {
  id: string;
  name: string;
}

// Tipo para las etapas de búsqueda
type SearchStage = 'analyzing' | 'connecting' | 'searching' | 'finished' | null;

interface UserData {
  accountStatus: boolean;
  birthDate: string;
  branchReference: string | { path: string; id: string };
  createdAt: string;
  email: string;
  firstName: string;
  id: string;
  isEmailVerified: boolean;
  isOnline: boolean;
  isVerified: boolean;
  lastName: string;
  lastSeen: string | null;
  phone: string;
  photoUrl: string;
  photo: string;
  preferredBranch: string;
  subscriptionPlan: string | { path: string; id: string };
  typeUserReference: string | { path: string; id: string };
  userId: string;
  walletReference: string | { path: string; id: string };
  branchDetails?: {
    name: string;
  };
  subscriptionDetails?: {
    planName: string;
    price?: string;
  };
  shipping_insurance: boolean;
}

/**
 * Componente para la búsqueda y visualización de tracking
 * Muestra los resultados de forma visual y atractiva con todos los datos disponibles
 * Permite la asignación de clientes a los paquetes
 * Aprovecha todo el ancho disponible de la pantalla
 */
const TrackingSearch: React.FC = () => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ExtendedTrackingInfo[]>([]);
  const [searchStage, setSearchStage] = useState<SearchStage>(null);
  const [selectedResult, setSelectedResult] = useState<SelectableItem | null>(null);
  const [showDetailView, setShowDetailView] = useState(false);
  const [detailedPackage, setDetailedPackage] = useState<ExtendedTrackingInfo | null>(null);
  const usersService = useMemo(() => new UsersService(), []);
  // Ya no creamos una nueva instancia de PackagesService, usamos la existente
  // const packagesService = useMemo(() => new PackagesService(), []);
  
  // Referencia para el timer de debounce
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const clientSearchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // API base URL para solicitudes directas - memoizado para evitar recálculos
  const apiBaseUrl = useMemo(() => 
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1',
  []);
  
  // Estado para el diálogo de cambio de cliente
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [availableClients, setAvailableClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [currentPackageId, setCurrentPackageId] = useState<string>('');
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [isAssigningClient, setIsAssigningClient] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Referencias para el scroll y elementos visuales
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  
  // Estado para alertas
  const [showInvoicedAlert, setShowInvoicedAlert] = useState(false);
  const [invoicedPackageId, setInvoicedPackageId] = useState<string>('');
  
  // Nuevo estado para el highlight
  const [highlightResults, setHighlightResults] = useState(false);
  
  // Obtener estado y funciones del contexto de facturas
  const { 
    packagesToInvoice, 
    isInvoiceModalOpen, 
    setIsInvoiceModalOpen,
    addPackageToInvoice,
    removePackageFromInvoice,
    clearInvoiceList,
    isPackageInInvoice
  } = useInvoice();
  
  // Obtener el color del tema desde el store
  const themeColor = useThemeSettingsStore(state => 
    state.themeColor === 'default' ? 'purple' : state.themeColor
  );
  
  // Variable para datos del operador (temporal mientras se implementa)
  const operatorData = useMemo(() => {
    // Obtener datos reales del operador logueado usando AuthService
    const loggedOperator = AuthService.getOperatorData();
    
    console.log('👤 Operador obtenido desde AuthService:', loggedOperator);
    
    if (!loggedOperator) {
      console.warn('⚠️ No se encontraron datos del operador en AuthService, usando valores temporales');
      return {
        id: 'temp-operator',
        name: 'Operador Temporal',
        branchReference: {
          id: '2980bf98-4b21-4b05-b128-1b99b34e952a', // ID de sucursal de prueba
          path: 'branches/2980bf98-4b21-4b05-b128-1b99b34e952a'
        },
        branchDetails: {
          name: 'Sucursal por defecto',
          id: '2980bf98-4b21-4b05-b128-1b99b34e952a' // ID de sucursal de prueba
        }
      };
    }
    
    // Determinar el ID de la sucursal del operador
    let branchId = '';
    let branchPath = '';
    
    // Intentar obtener de diferentes formatos posibles
    if (loggedOperator.branch_id) {
      branchId = loggedOperator.branch_id;
      branchPath = `branches/${branchId}`;
    } else if (loggedOperator.branchReference) {
      if (typeof loggedOperator.branchReference === 'string') {
        const parts = loggedOperator.branchReference.split('/');
        branchId = parts[parts.length - 1];
        branchPath = loggedOperator.branchReference;
      } else if (typeof loggedOperator.branchReference === 'object' && loggedOperator.branchReference?.id) {
        branchId = loggedOperator.branchReference.id;
        branchPath = `branches/${branchId}`;
      }
    }
    
    console.log('🏢 ID de sucursal determinado para estadísticas:', branchId);
    
    // Formatear los datos del operador para uso en el componente
    return {
      id: loggedOperator.id,
      name: `${loggedOperator.firstName || loggedOperator.first_name || ''} ${loggedOperator.lastName || loggedOperator.last_name || ''}`.trim(),
      branchReference: {
        id: branchId,
        path: branchPath
      },
      branchDetails: {
        name: loggedOperator.branchName || loggedOperator.branch_name || 'Sucursal sin nombre',
        id: branchId
      }
    };
  }, []);
  
  // Memoizar la conversión del color del tema para evitar recálculos
  const themeColorString = useMemo(() => 
    typeof themeColor === 'number' ? themeColor.toString() : themeColor,
  [themeColor]);

  // Add these near the other state variables:
  const [metrics, setMetrics] = useState({
    active: 42,
    inTransit: 18,
    delivered: 16,
    pending: 8
  });
  const [activeMetricFilter, setActiveMetricFilter] = useState<string | null>(null);

  // Estado para almacenar búsquedas recientes
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  
  // Contadores de estado para filtros
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [activeFilter, setActiveFilter] = useState<string>('');

  // Nuevo estado para las estadísticas
  const [branchStats, setBranchStats] = useState<PackageStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState<boolean>(false);
  
  // Estado para controlar si ya se ha intentado cargar estadísticas
  const [statsLoadAttempted, setStatsLoadAttempted] = useState<boolean>(false);
  
  // Añadir estos estados para controlar la animación
  const [isCreatingInvoices, setIsCreatingInvoices] = useState(false);
  const [creationProgress, setCreationProgress] = useState(0);
  const [finishedGroups, setFinishedGroups] = useState<string[]>([]);
  
  // Añadir un efecto para manejar correctamente la selección de clientes
  // Esto garantiza que el estado se refleje correctamente en la UI
  useEffect(() => {
    if (isClientDialogOpen) {
      console.log('🔍 Estado actual de selectedResult:', selectedResult);
    }
  }, [isClientDialogOpen, selectedResult]);

  /**
   * Devuelve un mensaje apropiado según la etapa de carga actual
   */
  const getLoadingMessage = (stage: SearchStage | null): string => {
    if (stage === 'analyzing') return "Analizando consulta...";
    if (stage === 'connecting') return "Conectando con el sistema...";
    if (stage === 'searching') return "Buscando paquete...";
    return "Cargando...";
  };

  /**
   * Devuelve un texto legible según el código de estado
   */
  const getStatusText = (status: string): string => {
    const statusMap: Record<string, string> = {
      'delivered': 'Entregados',
      'in_transit': 'En tránsito',
      'processing': 'En proceso',
      'pending': 'Pendientes',
      'canceled': 'Cancelados'
    };
    
    return statusMap[status] || status;
  };

  /**
   * Maneja la búsqueda de tracking de forma optimizada
   * @param query Término de búsqueda
   */
  const handleSearch = useCallback(async (query: string = searchQuery) => {
    if (!query.trim()) return;
    
    try {
      // Guardar la consulta para mostrarla en los resultados
      setSearchQuery(query.trim());
      
      // Guardar en búsquedas recientes sin duplicados
      setRecentSearches(prev => {
        const searches = prev.filter(s => s !== query.trim());
        return [query.trim(), ...searches].slice(0, 5);
      });
      
      // Limpiar resultados anteriores
      setSearchResults([]);
      setError(null);
      setIsLoading(true);
      setShowDetailView(false);
      setDetailedPackage(null);
      
      // Mostrar una sola etapa de búsqueda en lugar de varias con delays
      setSearchStage('searching');

      // Obtener el token de autenticación
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('workexpress_token='))
        ?.split('=')[1];

      if (!token) {
        throw new Error('No se encontró el token de autenticación');
      }

      // Realizar la búsqueda real usando el servicio directo
      const response = await DirectTrackingService.searchTrackings(query);

      // Si encontramos el paquete, verificar su estado
      if (response.success && response.data) {
        const packages = Array.isArray(response.data) ? response.data : [response.data];
        
        // Logs detallados para verificar la estructura de los paquetes
        packages.forEach((pkg, idx) => {
          console.log(`🔍 DEBUG - Paquete #${idx+1} recibido:`, {
            id: pkg.id,
            trackingNumber: pkg.trackingNumber,
            packageStatus: pkg.packageStatus,
            hasClient: !!pkg.client,
            client: pkg.client ? {
              id: pkg.client.id,
              name: pkg.client.name,
              shipping_insurance: pkg.client.shipping_insurance,
              shipping_insurance_type: typeof pkg.client.shipping_insurance
            } : null
          });
          
          // Asegurarnos de que shipping_insurance sea un booleano
          if (pkg.client && pkg.client.shipping_insurance !== undefined) {
            // Convertir explícitamente a booleano para evitar problemas con strings
            if (typeof pkg.client.shipping_insurance === 'string') {
              const insuranceValue = pkg.client.shipping_insurance.toLowerCase();
              pkg.client.shipping_insurance = insuranceValue === 'true' || insuranceValue === '1' || insuranceValue === 'yes';
              console.log(`🔄 Convertido shipping_insurance de string a booleano: ${insuranceValue} -> ${pkg.client.shipping_insurance}`);
            }
          }
        });
        
        // Verificar si el paquete está facturado
        const firstPackage = packages[0];
        if (firstPackage.packageStatus === 'INVOICED') {
          setInvoicedPackageId(firstPackage.trackingNumber);
          setShowInvoicedAlert(true);
          return;
        }

        // Si no está facturado, continuar normalmente
        setSearchResults(packages);
        
        // Log después de actualizar el estado
        console.log('✅ Estado searchResults actualizado con paquetes procesados:', 
          packages.map(p => ({ 
            id: p.id, 
            trackingNumber: p.trackingNumber,
            clientName: p.client?.name,
            hasInsurance: !!p.client?.shipping_insurance
          }))
        );
      }
      
      setSearchStage('finished');
    } catch (error) {
      console.error("Error al buscar tracking:", error);
      setError("No se pudo completar la búsqueda en este momento");
      setSearchStage(null);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  /**
   * Efecto para hacer scroll a los resultados cuando cambien
   */
  useEffect(() => {
    // Solo hacer scroll si hay resultados y no estamos cargando
    if (searchResults.length > 0 && !isLoading && resultsContainerRef.current) {
      // Breve retraso para asegurar que los componentes están renderizados
      const scrollTimer = setTimeout(() => {
        resultsContainerRef.current?.scrollIntoView({ 
          behavior: 'smooth',
          block: 'start' 
        });
        
        // Activar highlight por 2 segundos
        setHighlightResults(true);
        setTimeout(() => setHighlightResults(false), 2000);
      }, 100);
      
      return () => clearTimeout(scrollTimer);
    }
  }, [isLoading, searchResults]);

  /**
   * Carga la lista de clientes disponibles
   */
  const loadAvailableClients = async () => {
    setIsLoadingClients(true);
    
    try {
      // Usar directamente el endpoint correcto para obtener usuarios
      const apiUrl = `${apiBaseUrl}/users/all`;
      
      console.log('🔄 Obteniendo usuarios desde:', apiUrl);
      const directResponse = await fetch(apiUrl);
      
      if (!directResponse.ok) {
        throw new Error(`Error HTTP: ${directResponse.status}`);
      }
      
      const users = await directResponse.json();
      
      if (!users || users.length === 0) {
        console.warn('⚠️ No se encontraron usuarios');
        setAvailableClients([]);
        setFilteredClients([]);
        return;
      }
      
      // Log para verificar los datos recibidos
      console.log('🔍 DEBUG - Datos de usuarios recibidos del backend:', users.slice(0, 2));
      
      // Transformamos los datos a nuestro formato de Cliente
      const formattedClients = users
        .filter((user: UserData) => {
          // Simplificar la verificación de estado de cuenta
          if (typeof user.accountStatus === 'boolean') return user.accountStatus;
          if (typeof user.accountStatus === 'string') {
            const statusStr = String(user.accountStatus).toLowerCase();
            return statusStr === 'true' || statusStr === '1' || statusStr === 'active' || statusStr === 'activo';
          }
          if (typeof user.accountStatus === 'number') return user.accountStatus === 1;
          return true; // Si no tiene accountStatus, asumimos que está activo
        })
        .map((user: UserData) => {
          // IMPORTANTE: Usar siempre el ID correcto proporcionado por el backend
          console.log(`🔍 Usuario original del backend:`, {
            id: user.id,
            userId: user.userId, 
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName
          });

          // Mapear datos mínimos necesarios
          const mappedClient = {
            id: user.id || user.userId, // Priorizar el campo id, luego userId
            name: `${user.firstName} ${user.lastName}`.trim(),
            email: user.email,
            planRate: user.subscriptionDetails?.price ? parseFloat(user.subscriptionDetails.price) : 0,
            photo: user.photo || user.photoUrl || '',
            planName: user.subscriptionDetails?.planName || 'Sin plan',
            branchName: user.branchDetails?.name || 'Sin sucursal',
            shipping_insurance: user.shipping_insurance === true,
            subscriptionDetails: {
              planName: user.subscriptionDetails?.planName || 'Sin plan',
              price: user.subscriptionDetails?.price || '0.00'
            }
          };
          
          // Log detallado del cliente mapeado
          console.log(`✅ Cliente mapeado:`, {
            id: mappedClient.id,
            name: mappedClient.name,
            originalId: user.id,
            originalUserId: user.userId
          });
          
          return mappedClient;
        });
      
      console.log('📊 Clientes formateados:', formattedClients.slice(0, 2));
      setAvailableClients(formattedClients);
      setFilteredClients(formattedClients);
    } catch (error) {
      console.error("❌ Error al cargar clientes:", error);
      toast.error("Error al cargar los clientes disponibles");
      setAvailableClients([]);
      setFilteredClients([]);
    } finally {
      setIsLoadingClients(false);
    }
  };

  /**
   * Filtra los clientes con debounce para mejorar el rendimiento
   */
  const handleClientSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const searchTerm = e.target.value;
    setClientSearchQuery(searchTerm);
    
    // Cancelar el timer anterior si existe
    if (clientSearchDebounceRef.current) {
      clearTimeout(clientSearchDebounceRef.current);
    }
    
    // Aplicar filtro después de un breve retraso (debounce)
    clientSearchDebounceRef.current = setTimeout(() => {
      // Si el término de búsqueda está vacío, mostrar todos los clientes disponibles
      if (!searchTerm.trim()) {
        setFilteredClients(availableClients);
        return;
      }
      
      // Filtrar clientes basados en el término de búsqueda
      const filtered = availableClients.filter(client => {
        const searchTermLower = searchTerm.toLowerCase();
        const nameMatch = client.name?.toLowerCase().includes(searchTermLower);
        const emailMatch = client.email?.toLowerCase().includes(searchTermLower);
        return nameMatch || emailMatch;
      });
      
      setFilteredClients(filtered);
    }, 200); // 200ms debounce
  }, [availableClients]);

  /**
   * Abre el diálogo de asignación de cliente
   */
  const openClientDialog = async (packageId: string) => {
    console.log('🔍 Abriendo diálogo de clientes para el paquete:', packageId);
    
    // Primero, abrir el diálogo inmediatamente con estado de carga
    setCurrentPackageId(packageId);
    
    // IMPORTANTE: Establecer explícitamente selectedResult a null para evitar selecciones iniciales
    setSelectedResult(null);
    
    setClientSearchQuery('');
    setIsClientDialogOpen(true);
    
    // Comprobar si ya tenemos clientes cargados para evitar carga innecesaria
    if (availableClients.length === 0) {
      // Cargar clientes en segundo plano
      loadAvailableClients();
    } else {
      // Si ya tenemos clientes, simplemente establecer los filtrados
      setFilteredClients(availableClients);
    }
    
    // Verificación crítica del estado inicial para depuración
    console.log('🔎 Estado inicial del diálogo:', {
      selectedResult: null,
      currentPackageId: packageId,
      clientsCount: filteredClients.length
    });
    
    // Asegurarnos de que selectedResult sea null después de la actualización del estado
    setTimeout(() => {
      console.log('⏱️ Verificación después de timeout:', {
        selectedResult,
        isOpen: isClientDialogOpen
      });
    }, 100);
  };
  
  /**
   * Asigna un cliente al paquete
   */
  const handleAssignClient = async () => {
    if (!selectedResult || !currentPackageId) return;
    
    try {
      setIsAssigningClient(true);
      
      console.log('🔄 Iniciando asignación de cliente con datos:', {
        clientId: selectedResult.id,
        packageId: currentPackageId
      });
      
      // Verifica si estamos tratando con un ID tipo tracking (CNUSUP) o un UUID válido
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentPackageId);
      
      let packageUUID = currentPackageId;
      
      // Si no es UUID, necesitamos encontrar el UUID real
      if (!isUUID) {
        console.log('🔍 Detectado ID no válido, buscando UUID real para:', currentPackageId);
        
        // Buscar en los resultados si hay un UUID para este tracking
        const packageWithUUID = searchResults.find(
          pkg => (pkg.trackingNumber === currentPackageId || pkg.id === currentPackageId) && 
                 pkg.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pkg.id)
        );
        
        if (packageWithUUID?.id) {
          console.log('✅ Encontrado UUID real:', packageWithUUID.id);
          packageUUID = packageWithUUID.id;
        } else {
          console.warn('⚠️ No se encontró UUID para el tracking, se usará el ID original:', currentPackageId);
        }
      } else {
        console.log('✅ El ID ya es un UUID válido:', packageUUID);
      }
      
      // Verificar que el ID del cliente sea válido
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedResult.id)) {
        console.error('❌ Error: El ID del cliente no es un UUID válido:', selectedResult.id);
        toast.error('Error: ID de cliente inválido', {
          description: 'El ID del cliente seleccionado no tiene un formato UUID válido'
        });
        return;
      }
      
      console.log('🔄 Realizando asignación con packagesService:', {
        packageId: packageUUID,
        userId: selectedResult.id
      });
      
      // 1. Realizar la asignación de cliente
      await packagesService.assignUserToPackage(packageUUID, selectedResult.id);
      
      // 2. Obtener información completa del cliente después de la asignación
      console.log('🔄 Obteniendo datos completos del cliente asignado...');
      
      // Obtener el token de autenticación
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('workexpress_token='))
        ?.split('=')[1];

      if (!token) {
        throw new Error('No se encontró el token de autenticación');
      }
      
      // Obtener los datos completos del cliente del paquete
      const clientDetailsResponse = await fetch(`${apiBaseUrl}/packages/${packageUUID}/client`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!clientDetailsResponse.ok) {
        console.warn('⚠️ No se pudieron obtener los detalles completos del cliente:', clientDetailsResponse.statusText);
        // Si falló la obtención de detalles, usar los datos básicos que tenemos
        updateWithBasicClientInfo();
      
      toast.success('Cliente asignado correctamente', {
          description: 'El paquete ha sido actualizado, pero algunos detalles del cliente pueden estar incompletos.'
        });
      } else {
        const clientDetails = await clientDetailsResponse.json();
        console.log('✅ Datos completos del cliente obtenidos:', clientDetails);
        
        if (clientDetails.success && clientDetails.hasClient && clientDetails.data) {
          // Crear un objeto cliente enriquecido con todos los datos
          const enrichedClient: Client = {
            id: clientDetails.data.id,
            name: clientDetails.data.name,
            email: clientDetails.data.email,
            planRate: clientDetails.data.planRate || 0,
            photo: clientDetails.data.photo || '',
            planName: clientDetails.data.planName || 'Sin plan',
            branchName: clientDetails.data.branchName || 'Sin sucursal',
            shipping_insurance: clientDetails.data.shipping_insurance === true,
            subscriptionDetails: {
              planName: clientDetails.data.planName || 'Sin plan',
              price: clientDetails.data.planRate ? String(clientDetails.data.planRate) : '0.00'
            }
          };
          
          console.log('📊 Cliente enriquecido con datos completos:', enrichedClient);
          
          // Actualizar los resultados de búsqueda con los datos completos del cliente
        setSearchResults(
          searchResults.map(result => {
              if ((result.trackingNumber && result.trackingNumber === currentPackageId) || 
                  (result.id && result.id === currentPackageId)) {
              return {
                ...result,
                userReference: selectedResult.id,
                  client: enrichedClient
              };
            }
            return result;
          })
        );

        // Si estamos viendo los detalles, actualizamos también el paquete detallado
          if (showDetailView && detailedPackage && 
              ((detailedPackage.trackingNumber && detailedPackage.trackingNumber === currentPackageId) || 
               (detailedPackage.id && detailedPackage.id === currentPackageId))) {
          setDetailedPackage({
            ...detailedPackage,
            userReference: selectedResult.id,
              client: enrichedClient
            });
          }
          
          toast.success('Cliente asignado correctamente', {
            description: '¡El paquete ha sido actualizado con todos los datos del cliente!'
          });
        } else {
          // Si falló la obtención de detalles, usar los datos básicos que tenemos
          updateWithBasicClientInfo();
          
          toast.success('Cliente asignado correctamente', {
            description: 'El paquete ha sido actualizado, pero algunos detalles del cliente pueden estar incompletos.'
          });
        }
      }
      
      // Limpiar los estados y cerrar el diálogo
      setSelectedResult(null);
      setIsClientDialogOpen(false);
      setClientSearchQuery('');
      
    } catch (error) {
      console.error('❌ Error al asignar cliente:', error);
      toast.error('Error al asignar cliente al paquete', {
        description: 'Inténtalo de nuevo más tarde'
      });
      
      // Intentar actualizar con los datos básicos que tenemos en caso de error
      try {
        updateWithBasicClientInfo();
      } catch (e) {
        console.error('Error secundario al actualizar con datos básicos:', e);
      }
    } finally {
      setIsAssigningClient(false);
    }
  };
  
  // Función auxiliar para actualizar con datos básicos del cliente
  const updateWithBasicClientInfo = () => {
    // Encontrar el cliente seleccionado en la lista disponible
    const client = availableClients.find(c => c.id === selectedResult?.id);
    
    if (client && searchResults.length > 0) {
      console.log('🔄 Actualizando estado local con datos básicos del cliente:', client.name);
      
      const basicClient: Client = {
        id: client.id,
        name: client.name,
        email: client.email,
        planRate: client.planRate || 0,
        photo: client.photo || '',
        planName: client.planName || 'Sin plan',
        branchName: client.branchName || 'Sin sucursal',
        shipping_insurance: client.shipping_insurance === true || client.shipping_insurance === 'true',
        subscriptionDetails: client.subscriptionDetails || {
          planName: client.planName || 'Sin plan',
          price: client.planRate ? String(client.planRate) : '0.00'
        }
      };
      
      setSearchResults(
        searchResults.map(result => {
          if ((result.trackingNumber && result.trackingNumber === currentPackageId) || 
              (result.id && result.id === currentPackageId)) {
            return {
              ...result,
              userReference: selectedResult?.id,
              client: basicClient
            };
          }
          return result;
        })
      );

      // Si estamos viendo los detalles, actualizamos también el paquete detallado
      if (showDetailView && detailedPackage && 
          ((detailedPackage.trackingNumber && detailedPackage.trackingNumber === currentPackageId) || 
           (detailedPackage.id && detailedPackage.id === currentPackageId))) {
        setDetailedPackage({
          ...detailedPackage,
          userReference: selectedResult?.id,
          client: basicClient
        });
      }
    }
  };

  /**
   * Maneja la selección de un cliente
   */
  const handleClientSelect = (client: Client) => {
    console.log('👆 Cliente seleccionado:', client);
    
    // Verificar que el cliente tenga un ID válido
    if (!client.id) {
      console.error('Error: Cliente sin ID válido', client);
      toast.error('Error al seleccionar cliente: ID no válido');
      return;
    }
    
    // Usar directamente el ID del cliente sin modificarlo
    setSelectedResult(client);
    
    // Resaltar visualmente el cliente seleccionado en la consola
    console.log('✅ Cliente seleccionado:', {
      id: client.id,
      name: client.name,
      email: client.email,
      planRate: client.planRate,
      planName: client.subscriptionDetails?.planName,
      shipping_insurance: client.shipping_insurance
    });
  };

  /**
   * Obtiene el color adecuado para el estado del paquete
   * @param status Estado del paquete
   * @returns Clase de color
   */
  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    
    if (statusLower.includes('entreg') || statusLower === 'delivered') {
      return 'bg-green-50 text-green-700 border-green-200';
    }
    if (statusLower.includes('transit') || statusLower === 'in transit') {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    if (statusLower.includes('proces') || statusLower === 'processing') {
      return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    }
    if (statusLower.includes('cancel') || statusLower === 'cancelled') {
      return 'bg-red-50 text-red-700 border-red-200';
    }
    
    return 'bg-gray-50 text-gray-700 border-gray-200';
  };

  /**
   * Obtiene el ícono adecuado para el estado del paquete
   * @param status Estado del paquete
   * @returns Componente de ícono
   */
  const getStatusIcon = (status: string) => {
    const statusLower = status.toLowerCase();
    
    if (statusLower.includes('entreg') || statusLower === 'delivered') {
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    }
    if (statusLower.includes('transit') || statusLower === 'in transit') {
      return <Truck className="h-5 w-5 text-blue-500" />;
    }
    if (statusLower.includes('proces') || statusLower === 'processing') {
      return <Clock className="h-5 w-5 text-yellow-500" />;
    }
    if (statusLower.includes('cancel') || statusLower === 'cancelled') {
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    }
    
    return <PackageIcon className="h-5 w-5 text-gray-500" />;
  };

  /**
   * Formatea una fecha en formato legible
   * @param dateString Fecha en formato ISO
   * @returns Fecha formateada
   */
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No disponible';
    
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    
    return new Date(dateString).toLocaleDateString('es-ES', options);
  };

  // Función para depuración
  const debugUsers = async () => {
    try {
      toast.info("Intentando acceder a la API de usuarios...");
      
      // Intenta acceder directamente a la API con el endpoint correcto
      const apiUrl = `${apiBaseUrl}/users/all`;
      console.log("Intentando acceso directo a:", apiUrl);
      
      try {
        const directResponse = await fetch(apiUrl);
        
        if (!directResponse.ok) {
          throw new Error(`Error HTTP: ${directResponse.status}`);
        }
        
        const directData = await directResponse.json();
        console.log("Respuesta directa:", directData);
        toast.success(`Acceso directo exitoso: ${directData.length || 0} usuarios`);
      } catch (directError) {
        console.error("Error en acceso directo:", directError);
        toast.error("Error en acceso directo: " + String(directError));
      }
    } catch (error) {
      console.error("Error general en depuración:", error);
      toast.error("Error general: " + String(error));
    }
  };

  // Maneja la creación de una factura para un paquete
  const handleInvoicePackage = async (packageId: string) => {
    // Encontrar el paquete en los resultados
    const targetPackage = searchResults.find(pkg => 
      pkg.id === packageId || pkg.trackingNumber === packageId
    );
    
    if (!targetPackage) {
      toast.error("No se encontró el paquete especificado");
      return;
    }
    
    try {
      // Verificar si el paquete ya está facturado
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('workexpress_token='))
        ?.split('=')[1];

      if (!token) {
        throw new Error('No se encontró el token de autenticación');
      }

      const verifyResponse = await fetch(`http://localhost:3001/api/v1/invoices/verify-package/${targetPackage.trackingNumber}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include'
      });

      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json();
        throw new Error(errorData.message || 'Error al verificar el estado del paquete');
      }

      const verifyData = await verifyResponse.json();
      if (verifyData.isInvoiced) {
        toast.error(`Este paquete ya fue facturado (Factura #${verifyData.invoiceDetails?.invoice_number || 'N/A'})`);
        return;
      }
      
      // Si el paquete no tiene un cliente asignado, mostrar un error
      if (!targetPackage.client) {
        toast.error("Este paquete no tiene un cliente asignado. Por favor, asigna un cliente primero.");
        return;
      }

      // Obtener la tarifa del plan del cliente de diferentes fuentes posibles
      const client = targetPackage.client;
      const clientId = client.id;
      const clientName = client.name;
      
      const planRate = Number(
        client.planRate || 
        client.subscriptionDetails?.price || 
        0
      );

      if (!planRate) {
        toast.error('No se encontró la tarifa del plan del cliente');
        return;
      }

      // Determinar si el cliente tiene seguro de envío habilitado
      let hasShippingInsurance = false;
      
      // Verificación explícita para diferentes tipos de valores
      if ('shipping_insurance' in client) {
        if (typeof client.shipping_insurance === 'boolean') {
          hasShippingInsurance = client.shipping_insurance;
        } else if (typeof client.shipping_insurance === 'string') {
          hasShippingInsurance = client.shipping_insurance === 'true' || 
                              client.shipping_insurance === '1' || 
                              client.shipping_insurance.toLowerCase() === 'yes';
        } else if (typeof client.shipping_insurance === 'number') {
          hasShippingInsurance = client.shipping_insurance === 1;
        }
      }
      
      console.log('⚡ Datos de seguro para facturación:', {
        clientId,
        clientName,
        shipping_insurance: client.shipping_insurance,
        shipping_insurance_type: typeof client.shipping_insurance,
        hasShippingInsurance,
        hasShippingInsurance_type: typeof hasShippingInsurance
      });

      // Usar la función del contexto para agregar el paquete
      addPackageToInvoice(
        packageId,
        targetPackage.trackingNumber,
        Number(targetPackage.weight),
        clientId,
        clientName,
        planRate,
        {
          photo: client.photo,
          email: client.email,
          planName: client.planName || client.subscriptionDetails?.planName,
          branchName: client.branchName,
          shipping_insurance: hasShippingInsurance // Usar el valor booleano procesado
        }
      );
      
    } catch (error) {
      console.error('Error al agregar paquete:', error);
      toast.error(error instanceof Error ? error.message : 'Error al agregar el paquete');
    }
  };

  // Renderiza un único resultado de tracking en formato expandido
  const renderSingleResult = (result: ExtendedTrackingInfo) => {
    // Verificar si este paquete ya está en la lista de facturación usando el contexto
    const isInInvoiceList = isPackageInInvoice(
      result.id || '', 
      result.trackingNumber
    );
    
    return (
      <PackageResultCard
        key={result.id || result.trackingNumber}
        result={{
          ...result,
          client: result.client
        }}
        themeColor={themeColorString}
        onViewDetails={() => {
          setDetailedPackage(result);
          setShowDetailView(true);
        }}
        onChangeClient={(packageId) => openClientDialog(packageId)}
        addToInvoice={handleInvoicePackage}
        isInInvoice={result.isInvoiced === true || isInInvoiceList}
      />
    );
  };

  // Función para crear facturas masivamente
  const handleCreateInvoices = async () => {
    try {
      // Iniciar la animación
      setIsCreatingInvoices(true);
      setCreationProgress(0);
      setFinishedGroups([]);
      
      toast.info('🧾 Iniciando creación de facturas, por favor espere...');
      console.log('🚀 Iniciando creación de facturas para', packagesToInvoice.length, 'grupos de clientes');

      // Obtener el token de autenticación
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('workexpress_token='))
        ?.split('=')[1];

      if (!token) {
        console.error('🔑 Error: No se encontró el token de autenticación');
        toast.error('Error de autenticación', {
          description: 'No se encontró el token de autenticación. Intente iniciar sesión nuevamente.'
        });
        return;
      }

      console.log('🔐 Token encontrado:', token.substring(0, 10) + '...');

      // Crear una factura por cada grupo de cliente
      const totalGroups = packagesToInvoice.length;
      const results = await Promise.all(packagesToInvoice.map(async (group, index) => {
        try {
          // Actualizar el progreso antes de procesar cada grupo
          const currentProgress = Math.round(((index) / totalGroups) * 100);
          setCreationProgress(currentProgress);
          
          toast.info(`Procesando factura ${index + 1} de ${totalGroups}`, {
            id: 'invoice-progress',
            description: `Cliente: ${group.clientName} (${group.packages.length} paquetes)`
          });
          
          // Validar el ID del cliente
          if (!group.clientId) {
            console.error(`❌ Error: El cliente #${index + 1} (${group.clientName}) no tiene un ID válido`);
            toast.error(`Error en cliente ${group.clientName}`, {
              description: 'ID de cliente no válido'
            });
            return null;
          }

          // Procesar el ID de cliente para hacerlo alfanumérico
          const originalClientId = group.clientId;
          const processedClientId = group.clientId.replace(/-/g, '');
          
          console.log(`🔄 Procesando ID de cliente:`, {
            original: originalClientId,
            procesado: processedClientId,
            longitud: processedClientId.length
          });
          
          // Nota: Dejamos que el backend genere el número de factura
          // con el prefijo de la sucursal y un número aleatorio
          console.log(`📦 [${index + 1}/${packagesToInvoice.length}] Procesando factura para ${group.clientName} (ID: ${processedClientId})`);
          
          // Preparar los datos para la factura según el DTO esperado
          const invoiceData = {
            // Enviamos un invoice_number temporal para cumplir con la validación del DTO
            // El backend lo reemplazará con un número único con el formato correcto
            invoice_number: `TEMP-${Date.now()}`,
            customer_id: processedClientId, // Usar el ID procesado sin guiones
            issue_date: new Date().toISOString(),
            due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 días
            status: "sent", // Usamos sent por defecto, que es un estado válido según el enum
            total_amount: parseFloat(group.total.toFixed(2)),
            // Añadir explícitamente los campos price_plan y shipping_insurance
            price_plan: group.planRate || 0, // Usar la tarifa del plan como price_plan
            shipping_insurance: group.packages.length > 0 ? !!group.packages[0].hasInsurance : false, // Usar el valor del primer paquete
            invoice_items: group.packages.map(pkg => ({
              name: `Package - ${pkg.trackingNumber}`, // Formato: "Package - {trackingNumber}" para que el backend pueda extraerlo
              description: `Weight: ${pkg.weight}lb, Rate: $${group.planRate}`, // Formato específico para que el backend pueda extraer estos valores
              quantity: 1,
              price: parseFloat(pkg.price.toFixed(2))
            }))
          };

          console.log(`📄 Datos de factura para ${group.clientName}:`, {
            cliente: group.clientName,
            clienteId: invoiceData.customer_id,
            clienteIdOriginal: originalClientId,
            total: invoiceData.total_amount,
            paquetes: group.packages.length,
            primerPaquete: group.packages.length > 0 ? group.packages[0].trackingNumber : 'ninguno',
            // Añadir log para los nuevos campos
            price_plan: invoiceData.price_plan,
            shipping_insurance: invoiceData.shipping_insurance
          });

          // Intentar crear la factura
          try {
            console.log('🔄 Enviando solicitud para crear factura...');

            const response = await fetch('http://localhost:3001/api/v1/invoices', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              credentials: 'include',
              body: JSON.stringify(invoiceData)
            });

            if (!response.ok) {
              const errorData = await response.json();
              console.error('❌ Error al crear factura:', errorData);
              toast.error(`Error al crear factura para ${group.clientName}`, {
                description: errorData.message || response.statusText
              });
              return null;
            }

            const data = await response.json();
            console.log('✅ Factura creada:', data);
            
            // Añadir el cliente completado a la lista
            setFinishedGroups(prev => [...prev, group.clientName]);
            
            // Actualizar el progreso después de procesar el grupo
            const newProgress = Math.round(((index + 1) / totalGroups) * 100);
            setCreationProgress(newProgress);
            
            toast.success(`Factura creada para ${group.clientName}`, {
              id: `success-${group.clientId}`,
              description: `Total: $${parseFloat(group.total.toFixed(2))}`
            });
            
            // Simular un pequeño retraso para que la animación sea visible
            await new Promise(resolve => setTimeout(resolve, 300));
            
            return data;
          } catch (error) {
            console.error('❌ Error en la petición HTTP:', error);
            toast.error(`Error de conexión`, {
              description: `No se pudo conectar con el servidor para ${group.clientName}`
            });
            return null;
          }
        } catch (groupError) {
          console.error(`❌ Error al procesar grupo de ${group.clientName}:`, groupError);
          return null;
        }
      }));

      // Filtrar resultados nulos (facturas que fallaron)
      const successfulResults = results.filter(result => result !== null);
      
      console.log('📊 Facturas creadas:', successfulResults.length, 'de', totalGroups);

      // Finalizar con progreso 100%
      setCreationProgress(100);
      
      // Mostrar mensaje final de éxito
      if (successfulResults.length === packagesToInvoice.length) {
        toast.success(`¡Proceso completado!`, {
          description: `Se crearon ${successfulResults.length} facturas exitosamente`
        });
        
        // Limpiar la lista de paquetes y cerrar el modal solo si hubo alguna factura exitosa
        if (successfulResults.length > 0) {
          // Esperar un momento antes de cerrar para que se vea la animación completada
          await new Promise(resolve => setTimeout(resolve, 1500));
          clearInvoiceList();
          setIsInvoiceModalOpen(false);
        }
      } else if (successfulResults.length > 0) {
        toast.info(`Proceso completado parcialmente`, {
          description: `Se crearon ${successfulResults.length} de ${packagesToInvoice.length} facturas`
        });
        
        // Esperar un momento antes de cerrar
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Decidimos si limpiar todo o solo los éxitos
        if (successfulResults.length > packagesToInvoice.length / 2) {
          clearInvoiceList(); // Si la mayoría tuvo éxito, limpiar todo
        } else {
          // Si es una minoría, mostrar mensaje pero no cerrar
          toast.info('Los elementos no procesados permanecen en la lista', {
            description: 'Puede intentar nuevamente con los elementos restantes'
          });
        }
      } else {
        toast.error(`No se pudo crear ninguna factura`, {
          description: `Por favor, revise los errores e intente nuevamente`
        });
      }
    } catch (error) {
      console.error('❌ Error general:', error);
      toast.error(error instanceof Error ? error.message : 'Error al crear las facturas');
    } finally {
      // Desactivar la animación cuando termine (éxito o error)
      setIsCreatingInvoices(false);
      setCreationProgress(0);
      setFinishedGroups([]);
    }
  };

  /**
   * Sincronizar la lista filtrada con los clientes disponibles cuando estos cambian
   * y no hay término de búsqueda activo
   */
  useEffect(() => {
    if (!clientSearchQuery.trim()) {
      setFilteredClients(availableClients);
    }
  }, [availableClients]);

  // Add this function to handle metric card clicks for filtering
  const handleMetricFilter = (metricType: string) => {
    if (activeMetricFilter === metricType) {
      setActiveMetricFilter(null);
      // Reset filter logic here
      toast.info('Filtro removido');
    } else {
      setActiveMetricFilter(metricType);
      // Apply filter logic here
      toast.success(`Mostrando paquetes: ${metricType}`);
    }
  };

  // Función para cargar estadísticas de la sucursal
  const loadBranchStats = useCallback(async () => {
    // Evitar cargar estadísticas si ya lo hemos intentado o si no hay ID de sucursal
    if (statsLoadAttempted || !operatorData?.branchReference) {
      return;
    }
    
    console.log('📊 Iniciando carga de estadísticas');
    console.log('🔍 Datos del operador:', operatorData);
    
    try {
      setIsLoadingStats(true);
      setStatsLoadAttempted(true); // Marcar que ya se ha intentado cargar

      // Obtener el ID de la sucursal del operador
      let branchId = '';
      
      if (typeof operatorData.branchReference === 'string') {
        // Si es una referencia directa, intentar extraer el ID
        console.log('🔍 branchReference es string:', operatorData.branchReference);
        try {
          const parts = operatorData.branchReference.split('/');
          branchId = parts[parts.length - 1];
          console.log('📋 ID de sucursal extraído:', branchId);
        } catch (error) {
          console.error('❌ Error al extraer ID de sucursal:', error);
        }
      } else if (operatorData.branchReference && typeof operatorData.branchReference === 'object') {
        // Si es un objeto con id
        console.log('🔍 branchReference es objeto:', operatorData.branchReference);
        branchId = operatorData.branchReference.id;
        console.log('📋 ID de sucursal extraído del objeto:', branchId);
      }
      
      if (!branchId) {
        console.error('❌ No se pudo determinar el ID de la sucursal');
        return;
      }
      
      console.log('🔄 Llamando al servicio de estadísticas con branchId:', branchId);
      
      // Llamar al servicio con un timeout para evitar que la promesa quede colgada
      const timeoutPromise = new Promise<any>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout al obtener estadísticas')), 15000)
      );
      
      const statsPromise = StatsService.getAssignedNotInvoicedPercentage(branchId);
      
      // Race entre el timeout y la llamada real
      const response = await Promise.race([statsPromise, timeoutPromise]);
      console.log('📊 Respuesta del servicio:', response);
      
      if (response.success && response.data) {
        console.log('✅ Estadísticas obtenidas correctamente:', response.data);
        setBranchStats(response.data);
      } else {
        console.error('❌ Error al cargar estadísticas:', response.message);
      }
    } catch (error) {
      console.error('❌ Error al cargar estadísticas:', error);
      // No mostramos error al usuario para no interrumpir su experiencia
    } finally {
      setIsLoadingStats(false);
    }
  }, [operatorData?.branchReference, statsLoadAttempted]);
  
  // Cargar estadísticas cuando se carga el componente
  useEffect(() => {
    loadBranchStats();
  }, [loadBranchStats]);

  // Retorno del componente principal - interfaz de usuario
  return (
    <div className="flex flex-col space-y-8 w-full max-w-5xl mx-auto">
      {/* Sección de búsqueda - Diseño simplificado y como elemento principal */}
      <div className="w-full pt-4">
        {/* Título y descripción destacados */}
        <div className="mb-6 text-center">
          <div className="flex justify-center mb-3">
            <div className="bg-primary/10 p-3 rounded-full">
              <PackageCheck className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h2 className="text-2xl font-semibold mb-2 tracking-tight">Sistema de Seguimiento de Paquetes</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Ingrese un número de tracking para obtener información actualizada sobre el estado de su envío
          </p>
        </div>

        {/* Formulario de búsqueda simplificado y prominente */}
        <div className="w-full bg-card border rounded-lg shadow-sm p-6 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent rounded-lg opacity-50"></div>
          <div className="relative z-10">
            <div className="flex flex-col gap-1 mb-6">
              <label htmlFor="tracking-input" className="text-sm font-medium mb-1">
                Número de tracking
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Input
                    id="tracking-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Ingrese número de tracking (WEX123456789)"
                    className="h-11 text-base"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchQuery.trim()) {
                        handleSearch(searchQuery);
                      }
                    }}
                  />
                  {searchQuery && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => setSearchQuery('')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <Button
                  size="lg"
                  className="h-11 px-6 text-base"
                  onClick={() => handleSearch(searchQuery)}
                  disabled={isLoading || !searchQuery.trim()}
                >
                  {isLoading ? (
                    <span className="flex items-center">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Buscando...
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <Search className="mr-2 h-4 w-4" />
                      Buscar
                    </span>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                El código de tracking se encuentra en su correo de confirmación o en la etiqueta del paquete
              </p>
            </div>
            
            {/* Búsquedas recientes simplificadas */}
            {recentSearches.length > 0 && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground flex items-center">
                    <Clock className="h-3.5 w-3.5 mr-1.5" />
                    Búsquedas recientes
                  </span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-xs text-muted-foreground"
                    onClick={() => setRecentSearches([])}
                  >
                    Limpiar historial
                  </Button>
              </div>
                <div className="flex flex-wrap gap-1.5">
                  {recentSearches.map((search) => (
                    <Badge 
                      key={search} 
                      variant="outline" 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        setSearchQuery(search);
                        handleSearch();
                      }}
                    >
                      {search}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Características del servicio - Nueva sección mejorada */}
      {!searchResults.length && !isLoading && (
        <>
          <div className="bg-gradient-to-r from-background to-muted/30 rounded-2xl shadow-sm p-6 mt-6 border">
            <div className="text-center mb-8">
              <h3 className="text-xl font-semibold mb-2">Sistema de seguimiento WorkExpress</h3>
              <p className="text-sm text-muted-foreground max-w-xl mx-auto">Gestione todos sus envíos con precisión y eficiencia. Nuestra plataforma le permite monitorear en tiempo real el estado de sus paquetes.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-full">
                      <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <CardTitle className="text-base font-medium">
                      Seguimiento en tiempo real
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Información actualizada sobre el estado y ubicación de tus paquetes durante todo el trayecto.
                  </p>
                </CardContent>
              </Card>
              
              <Card className="border shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <CardTitle className="text-base font-medium">
                      Confirmación de entregas
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Notificaciones y verificación de entregas con registros detallados para tu tranquilidad.
                  </p>
                </CardContent>
              </Card>
              
              <Card className="border shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-full">
                      <Info className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
                    <CardTitle className="text-base font-medium">
                      Detalles completos
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Accede a información detallada de tus envíos, incluidos peso, dimensiones y datos de facturación.
                  </p>
          </CardContent>
        </Card>
            </div>
            {/* Estadísticas del sistema - Con datos dinámicos */}
            <div className="mt-10">
              <h3 className="text-lg font-medium mb-4">Estado del sistema</h3>
              <Card className="border bg-card/40">
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Paquetes con clientes asignados pendientes de facturar
                    </p>
                    {isLoadingStats ? (
                      <div className="animate-pulse h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="text-3xl font-semibold">
                          {branchStats?.percentage ?? 0}%
                        </p>
                        {branchStats?.trend !== undefined && (
                          <Badge 
                            className={cn(
                              branchStats.trend > 0 
                                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400"
                                : branchStats.trend < 0
                                  ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
                                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-900/30 dark:text-gray-400"
                            )}
                          >
                            {branchStats.trend > 0 ? (
                              <ArrowRight className="h-3 w-3 rotate-45 mr-1" />
                            ) : branchStats.trend < 0 ? (
                              <ArrowRight className="h-3 w-3 rotate-[-45deg] mr-1" />
                            ) : (
                              <ArrowRight className="h-3 w-3 rotate-0 mr-1" />
                            )}
                            {Math.abs(branchStats.trend)}% {branchStats.trend > 0 ? 'más' : branchStats.trend < 0 ? 'menos' : 'igual'} este mes
                          </Badge>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {branchStats?.assignedNotInvoiced ?? 0} de {branchStats?.totalPackages ?? 0} paquetes en tu sucursal tienen cliente asignado pero aún no se han facturado
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-4 rounded-full">
                    <User className="h-8 w-8 text-primary" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          <div className="mt-10">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-semibold">Métricas de Envíos</h3>
              <div className="flex space-x-1">
                <Button
                  variant="outline"
                  size="sm"
          className={cn(
                    "text-xs h-8",
                    !activeFilter && "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                  )}
                  onClick={() => handleMetricFilter('')}
                >
                  Todos
                </Button>
                {Object.keys(statusCounts).map((status) => (
                  <Button
                    key={status}
                    variant="outline"
                    size="sm"
                    className={cn(
                      "text-xs h-8",
                      activeFilter === status && "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                    )}
                    onClick={() => handleMetricFilter(status)}
                  >
                    {status} ({statusCounts[status]})
                  </Button>
                ))}
              </div>
            </div>
            <Card className="border border-border/40 bg-card/40">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <BarChart className="h-10 w-10 text-muted-foreground/50 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">Gráfico de estadísticas no disponible</p>
                </div>
              </CardContent>
            </Card>
          </div>
          {/* Eliminar la sección estática de estadísticas del sistema */}
        </>
      )}

      {/* Indicador de carga simplificado */}
      {isLoading && (
        <div className="flex justify-center my-8">
          <div className="flex flex-col items-center">
            <div className="bg-primary/10 p-4 rounded-full mb-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <p className="text-base font-medium mb-1">{getLoadingMessage(searchStage)}</p>
            <p className="text-sm text-muted-foreground">Por favor espere mientras procesamos su solicitud</p>
          </div>
        </div>
      )}

      {/* Filtros visibles solo cuando hay resultados - Diseño simplificado */}
      
      {/* Resultados de la búsqueda - Vista de detalle */}
      {searchResults.length > 0 && (
        <div className={cn(
            "transition-all duration-300 ease-in-out",
          highlightResults && "ring-1 ring-primary/30 rounded-lg"
        )}>
          <Card className="border shadow-sm overflow-hidden">
            <CardHeader className="pb-3 border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PackageCheck className="h-5 w-5 text-primary/80" />
                  <CardTitle className="text-base font-medium">
                    Resultados de la búsqueda
                  </CardTitle>
                </div>
                <Badge variant="outline" className="bg-muted/50">
                  {searchResults.length} {searchResults.length === 1 ? 'paquete' : 'paquetes'}
                </Badge>
              </div>
                </CardHeader>
            <CardContent className="p-0">
              {/* Vista de Detalle */}
              {showDetailView && detailedPackage && (
                <div className="p-4">
                          <Button 
                    variant="ghost" 
                    size="sm" 
                    className="mb-4 text-sm hover:bg-muted/50"
                            onClick={() => setShowDetailView(false)}
                          >
                    <ChevronLeft className="h-4 w-4 mr-1.5" />
                    Volver a resultados
                          </Button>
                        
                        <PackageDetailView 
                          package={detailedPackage} 
                          themeColor={themeColorString} 
                          onClientChange={openClientDialog}
                        />
                </div>
              )}

              {/* Vista de Resultados */}
              {!showDetailView && (
                <div className="p-0">
                  {/* Resultado único */}
                  {searchResults.length === 1 ? (
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Badge variant="outline" className="px-2 py-1 bg-muted/50">
                          Paquete único
                        </Badge>
                      </div>
                      
                      <div className="w-full">
                        {renderSingleResult(searchResults[0])}
                      </div>
                      </div>
                    ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-muted/50 border-b border-border/50 text-left">
                            <th className="p-3 text-xs font-medium text-muted-foreground">Tracking</th>
                            <th className="p-3 text-xs font-medium text-muted-foreground">Estado</th>
                            <th className="p-3 text-xs font-medium text-muted-foreground">Cliente</th>
                            <th className="p-3 text-xs font-medium text-muted-foreground">Peso</th>
                            <th className="p-3 text-xs font-medium text-muted-foreground">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                      {searchResults.map((result, index) => (
                            <tr 
                          key={result.id || result.trackingNumber}
                              className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors"
                            >
                              <td className="p-3">
                                <div className="font-medium text-sm">{result.trackingNumber}</div>
                                {result.origin && result.destination && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {result.origin} → {result.destination}
                                  </div>
                                )}
                              </td>
                              <td className="p-3">
                                {getStatusIcon(result.status || 'pending')}
                              </td>
                              <td className="p-3">
                                {result.client ? (
                                  <div className="flex items-center gap-2.5">
                                    <Avatar className="h-7 w-7 border border-border/40">
                                      {result.client.photo ? (
                                        <AvatarImage src={result.client.photo} alt={result.client.name} />
                                      ) : (
                                        <AvatarFallback className="text-xs">
                                          {result.client.name.slice(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                      )}
                                    </Avatar>
                                    <div className="flex flex-col">
                                      <div className="text-sm font-medium">{result.client.name}</div>
                                      <div className="text-xs text-muted-foreground">{result.client.planName || result.client.subscriptionDetails?.planName}</div>
                                    </div>
                                  </div>
                                ) : (
                                  <Button
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => openClientDialog(result.id || result.trackingNumber)}
                                    className="text-xs h-7 px-2 text-muted-foreground"
                                  >
                                    <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                                    Asignar
                                  </Button>
                                )}
                              </td>
                              <td className="p-3">
                                {result.weight ? (
                                  <span className="text-sm">{result.weight} Lb</span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">N/A</span>
                                )}
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                              setDetailedPackage(result);
                              setShowDetailView(true);
                            }}
                                    className="h-7 w-7 rounded-md"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                  
                                  {result.client && !result.isInvoiced && !isPackageInInvoice(result.id || '', result.trackingNumber) && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 rounded-md"
                                      onClick={() => handleInvoicePackage(result.id || result.trackingNumber)}
                                    >
                                      <Receipt className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  
                                  {!result.client && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 rounded-md"
                                      onClick={() => openClientDialog(result.id || result.trackingNumber)}
                                    >
                                      <UserPlus className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                    </div>
                  )}
                </CardContent>
              </Card>
        </div>
      )}

      {/* Sección de Facturación simplificada */}
      {packagesToInvoice.length > 0 && (
        <div className="fixed bottom-6 right-6 floating-action-button">
          <Button
          onClick={() => setIsInvoiceModalOpen(true)}
            className="rounded-full flex items-center gap-2 shadow-lg h-10 px-4 bg-primary hover:bg-primary/90"
          >
            <div className="flex items-center">
              <span className="font-medium">{packagesToInvoice.reduce((sum, group) => sum + group.packages.length, 0)}</span>
              <span className="text-xs ml-1">paquetes</span>
          </div>
            <div className="w-px h-4 bg-white/20"></div>
            <span className="font-medium">${packagesToInvoice.reduce((sum, group) => sum + group.total, 0).toFixed(2)}</span>
            <Receipt className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Client Assignment Dialog - Professional Style */}
      <Dialog open={isClientDialogOpen} onOpenChange={setIsClientDialogOpen}>
        <DialogContent className="sm:max-w-md border-border/60 shadow-xl bg-card/95 backdrop-blur-sm client-dialog-fix z-[101]">
          <DialogHeader className="pb-4 border-b border-border/40">
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shadow-sm">
                <UserPlus className="h-5 w-5 text-primary" />
              </div>
              Asignación de Cliente
            </DialogTitle>
            <DialogDescription className="text-muted-foreground/90 mt-2">
              Seleccione un cliente para asignar al paquete seleccionado
            </DialogDescription>
          </DialogHeader>

          <div className="py-5">
            <div className="mb-4 relative">
              <div className="absolute left-3 top-2.5 text-muted-foreground">
                <Search className="h-4 w-4" />
                </div>
              <Input
                type="text"
                placeholder="Buscar cliente..."
                value={clientSearchQuery}
                onChange={handleClientSearchChange}
                className="pl-9 bg-background/70 border-border/50 focus-visible:ring-primary/20"
              />
            </div>
            
            <div className="max-h-[250px] overflow-y-auto pr-1 -mr-1 space-y-1.5">
              {filteredClients.length === 0 ? (
                <div className="text-center py-10 bg-muted/30 rounded-lg border border-border/40">
                  <UserX2 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-1">No se encontraron clientes</p>
                  <p className="text-xs text-muted-foreground/70 max-w-sm mx-auto">
                    Intente con otro término de búsqueda o contacte al administrador
            </p>
          </div>
            ) : (
                filteredClients.map((client, index) => {
                  // Asegurarse de que cada cliente tenga un ID único para React
                  const clientId = client.id || client.userId || `client-${index}-${client.name.replace(/\s+/g, '-').toLowerCase()}`;
                  
                  // Determinar si este cliente está seleccionado
                  const isSelected = selectedResult?.id === clientId;
                  
                  console.log(`🔍 Renderizando cliente ${clientId}: ${isSelected ? 'SELECCIONADO' : 'no seleccionado'}`);
                  
                  return (
        <button
                      key={clientId} // Usar el ID generado como clave única
                      className={`w-full flex items-center gap-3 p-3 rounded-lg ${
                        isSelected
                          ? 'bg-primary/15 border border-primary/30 shadow-sm' 
                          : 'hover:bg-muted/60 border border-transparent'
                      } transition-colors text-left`}
                      onClick={() => handleClientSelect({...client, id: clientId})}
                    >
                      <Avatar className="h-10 w-10 border border-border/40 shadow-sm">
                        {client.photo ? (
                          <AvatarImage src={client.photo} alt={client.name} />
                        ) : (
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {client.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className="flex-1">
                        <div className="font-medium">{client.name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <BadgeCheck className="h-3 w-3" />
                          {client.planName || client.subscriptionDetails?.planName || 'Sin plan asignado'}
          </div>
                        {client.email && (
                          <div className="text-xs text-muted-foreground/80 mt-1">
                            {client.email}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <div className="h-5 w-5 rounded-full bg-primary/30 flex items-center justify-center">
                          <Check className="h-3 w-3 text-primary" />
                        </div>
                      )}
        </button>
                  );
                })
              )}
              </div>
              </div>
          
          <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-border/40">
            <Button
              variant="outline"
              onClick={() => setIsClientDialogOpen(false)}
              className="hover:bg-muted/50 transition-colors"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAssignClient}
              disabled={!selectedResult || isAssigningClient}
              className="bg-primary/90 hover:bg-primary transition-colors"
            >
              {isAssigningClient ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Asignando...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Asignar Cliente
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert de paquete ya facturado - Simplificado */}
      <AlertDialog open={showInvoicedAlert} onOpenChange={setShowInvoicedAlert}>
        <AlertDialogContent className="max-w-md alert-dialog-fix z-[101]">
          <AlertDialogHeader>
            <AlertDialogTitle>Paquete Ya Procesado</AlertDialogTitle>
            <AlertDialogDescription>
              Este paquete ya ha sido procesado para facturación.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="bg-muted/30 p-3 rounded-md my-2">
            <p className="text-sm font-medium">ID de Factura: <span className="text-primary">{invoicedPackageId}</span></p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Entendido</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de facturación - Mejorado */}
      <Dialog open={isInvoiceModalOpen} onOpenChange={setIsInvoiceModalOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-xl border-0 shadow-2xl dark:shadow-slate-900/20 dialog-content-fix">
          {/* Encabezado con gradiente */}
          <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border-b border-slate-200/80 dark:border-slate-800/80">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10 text-primary">
                  <Receipt className="h-5 w-5" />
              </div>
                <DialogTitle className="text-xl font-semibold">Facturación de Paquetes</DialogTitle>
              </div>
              <DialogDescription className="pt-2 text-muted-foreground">
                Revisa los paquetes seleccionados y genera las facturas correspondientes
              </DialogDescription>
          </DialogHeader>
          </div>

          {/* Contenido principal con scroll */}
          <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
            {packagesToInvoice.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="p-4 rounded-full bg-muted mb-4">
                  <Package className="h-10 w-10 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-medium mb-1">No hay paquetes seleccionados</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Agrega paquetes a la lista de facturación desde la vista de detalles de cada paquete
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {packagesToInvoice.map((group) => (
                  <div
                    key={group.clientId}
                    className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm transition-all hover:shadow-md"
                  >
                    {/* Cabecera del cliente */}
                    <div className="p-4 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-900/80">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border-2 border-white dark:border-slate-800 shadow-sm">
                            {group.clientPhoto ? (
                            <AvatarImage src={group.clientPhoto} alt={group.clientName} />
                          ) : (
                            <AvatarFallback className="bg-primary/10 text-primary font-medium">
                              {group.clientName.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          )}
                        </Avatar>
                            <div>
                          <p className="font-medium text-base">{group.clientName}</p>
                          <div className="flex items-center text-xs text-muted-foreground mt-1">
                            <Package className="h-3 w-3 mr-1.5" />
                            <span>{group.packages.length} paquete{group.packages.length !== 1 ? 's' : ''}</span>
                            <span className="mx-2 text-slate-300 dark:text-slate-700">•</span>
                            <DollarSign className="h-3 w-3 mr-1" />
                            <span>Tarifa: ${group.planRate}/Lb</span>
                                </div>
                              </div>
                            </div>
                      <div className="text-right bg-primary/5 px-4 py-2 rounded-lg">
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="text-lg font-semibold text-primary">${group.total.toFixed(2)}</p>
                      </div>
                    </div>

                    {/* Tabla de paquetes */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800/50 text-left border-y border-slate-200 dark:border-slate-800">
                            <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Tracking</th>
                            <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Peso</th>
                            <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Precio</th>
                            <th className="px-4 py-3 text-xs font-medium text-muted-foreground w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {group.packages.map((pkg) => (
                            <tr 
                          key={pkg.id}
                              className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                            >
                              <td className="px-4 py-3">
                                <div className="flex flex-col">
                                  <span className="font-medium">{pkg.trackingNumber}</span>
                                  {pkg.hasInsurance && (
                                    <span className="text-xs text-emerald-600 dark:text-emerald-500 flex items-center mt-1">
                                      <Shield className="h-3 w-3 mr-1" />
                                      Seguro de envío
                                    </span>
                                  )}
                          </div>
                              </td>
                              <td className="px-4 py-3">
                                <Badge variant="outline" className="font-normal bg-slate-50 dark:bg-slate-800">
                                  {pkg.weight} Lb
                                </Badge>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col">
                                  <span className="font-medium">${pkg.price.toFixed(2)}</span>
                                  {pkg.hasInsurance && pkg.insurancePrice && (
                                    <span className="text-xs text-muted-foreground mt-0.5">
                                      Incluye seguro: ${pkg.insurancePrice.toFixed(2)}
                                    </span>
                                  )}
                          </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950"
                            onClick={() => removePackageFromInvoice(group.clientId, pkg.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                      ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
                    </div>

          {/* Footer con acciones */}
          <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsInvoiceModalOpen(false)}
                  disabled={isCreatingInvoices}
                  className="gap-2"
                >
                  <X className="h-4 w-4" />
                  Cerrar
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => clearInvoiceList()}
                  disabled={packagesToInvoice.length === 0 || isCreatingInvoices}
                  className="gap-2 text-rose-600 dark:text-rose-500 border-rose-200 dark:border-rose-950 hover:bg-rose-50 dark:hover:bg-rose-950"
                >
                  <Trash2 className="h-4 w-4" />
                  Limpiar
                </Button>
              </div>
              
              {isCreatingInvoices ? (
                <div className="w-1/2 space-y-2">
                  <div className="flex justify-between items-center text-sm text-muted-foreground mb-1">
                    <span>Procesando facturas...</span>
                    <span>{creationProgress}%</span>
                  </div>
                  
                  <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-300 rounded-full"
                      style={{ width: `${creationProgress}%` }}
                    />
                  </div>
                  
                  {finishedGroups.length > 0 && (
                    <div className="mt-2 p-2 text-right">
                      <span className="text-xs text-muted-foreground">
                        {finishedGroups.length} de {packagesToInvoice.length} completadas
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <Button 
                  onClick={handleCreateInvoices}
                  disabled={packagesToInvoice.length === 0}
                  className="gap-2 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary shadow-md hover:shadow-lg transition-all"
                >
                  <Receipt className="h-4 w-4" />
                  Crear Facturas
                </Button>
              )}
            </div>
            
            {/* Mostrar la lista de facturas completadas */}
            {isCreatingInvoices && finishedGroups.length > 0 && (
              <div className="mt-4 max-h-32 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-md p-2 bg-white dark:bg-slate-900">
                <p className="text-xs font-medium text-muted-foreground mb-2">Facturas completadas:</p>
                <div className="space-y-1">
                  {finishedGroups.map((clientName, index) => (
                    <div key={index} className="flex items-center gap-2 text-xs">
                      <span className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0 flex items-center justify-center">
                        <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"></path>
                        </svg>
                      </span>
                      <span className="truncate">{clientName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TrackingSearch;