import { API_URL } from '@/config/constants';

/**
 * Obtiene una cookie por su nombre
 * @param name Nombre de la cookie
 * @returns Valor de la cookie o null si no existe
 */
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null; // Estamos en el servidor
  }
  
  const cookies = document.cookie.split(';');
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i].trim();
    if (cookie.startsWith(name + '=')) {
      return cookie.substring(name.length + 1);
    }
  }
  return null;
}

export interface ShippingStage {
  location: string;
  photo: string;
  stage: string;
  status: string;
  updatedTimestamp: string;
}

export interface TrackingInfo {
  id?: string;
  packageId?: string;
  trackingNumber: string;
  packageStatus: string;
  weight: number;
  volumetricWeight: number;
  length: number;
  width: number;
  height: number;
  insurance: boolean;
  shippingStages: ShippingStage[];
  userReference?: string;
  createdAt?: string;
  client?: {
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
  };
  status?: string;
  status_name?: string;
  isInvoiced?: boolean;
  invoiceDetails?: {
    invoice_number: string;
    [key: string]: any;
  };
  declared_value?: number | string;
  position?: string;
}

export interface TrackingResponse {
  success: boolean;
  message?: string;
  data?: TrackingInfo | TrackingInfo[];
  error?: string;
}

/**
 * Servicio para buscar tracking directamente usando los endpoints del backend
 * Esta implementación conecta directamente con los endpoints de la API sin pasar por Next.js API routes
 */
export class DirectTrackingService {
  private static getAuthHeaders() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    
    const token = getCookie('workexpress_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  }
  
  /**
   * Busca un paquete por su número de tracking
   * @param trackingNumber Número de tracking
   * @returns Respuesta de la API con datos del tracking o error
   */
  static async findByTracking(trackingNumber: string): Promise<TrackingResponse> {
    console.log('🔍 DirectTrackingService.findByTracking - Buscando paquete con tracking:', trackingNumber);
    
    try {
      const headers = this.getAuthHeaders();
      console.log('📊 DirectTrackingService.findByTracking - URL de API:', API_URL);
      const url = `${API_URL}/packages/tracking/${trackingNumber}`;
      console.log('🔎 DirectTrackingService.findByTracking - URL completa:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'include'
      });
      
      console.log('📡 DirectTrackingService.findByTracking - Estado respuesta:', response.status, response.statusText);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log('⚠️ DirectTrackingService.findByTracking - Buscando en servicio de cargo externo...');
          return this.findByExternalTracking(trackingNumber);
        } else {
          console.error('❌ DirectTrackingService.findByTracking - Error en la respuesta:', response.status);
          const errorText = await response.text();
          console.log('📝 DirectTrackingService.findByTracking - Texto de error:', errorText);
          
          return {
            success: false,
            error: `Error en la búsqueda: ${response.status}`,
            message: errorText || 'Error desconocido'
          };
        }
      }
      
      const data = await response.json();
      
      // Verificar si el paquete tiene un usuario (campo 'user') pero no tiene cliente (campo 'client')
      // Si es así, transformarlo para asegurar compatibilidad con los tipos y componentes frontend
      if (data.user && !data.client) {
        console.log('🔄 DirectTrackingService - Transformando campo "user" a "client"');
        data.client = {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          planRate: data.user.planRate || 0,
          photo: data.user.photo,
          planName: data.user.planName,
          branchName: data.user.branchName,
          shipping_insurance: data.user.shipping_insurance
        };
      }
      
      console.log('✅ DirectTrackingService.findByTracking - Paquete encontrado:', data);
      
      // Logs detallados para depuración
      console.log('📋 DirectTrackingService - Estructura del paquete:', {
        id: data.id,
        trackingNumber: data.trackingNumber,
        hasUser: !!data.userId,
        userId: data.userId,
        hasClient: !!data.client,
        clientKeys: data.client ? Object.keys(data.client) : [],
        clientData: data.client ? {
          id: data.client.id,
          name: data.client.name,
          email: data.client.email,
          hasShippingInsurance: 'shipping_insurance' in data.client,
          shippingInsurance: data.client.shipping_insurance,
          shippingInsuranceType: typeof data.client.shipping_insurance
        } : null
      });
      
      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('❌ DirectTrackingService.findByTracking - Error:', error);
      
      return {
        success: false,
        error: `Error en la búsqueda: ${error instanceof Error ? error.message : 'Error desconocido'}`
      };
    }
  }
  
  /**
   * Busca un número de tracking en el servicio externo de cargo
   * @param trackingNumber Número de tracking
   * @returns Respuesta de la API con datos del tracking externo o error
   */
  static async findByExternalTracking(trackingNumber: string): Promise<TrackingResponse> {
    console.log('🌐 DirectTrackingService.findByExternalTracking - Buscando tracking externo:', trackingNumber);
    
    try {
      const headers = this.getAuthHeaders();
      const url = `${API_URL}/cargo/external-tracking/${trackingNumber}`;
      console.log('🔎 DirectTrackingService.findByExternalTracking - URL completa:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'include'
      });
      
      console.log('📡 DirectTrackingService.findByExternalTracking - Estado respuesta:', response.status, response.statusText);
      
      if (!response.ok) {
        console.error('❌ DirectTrackingService.findByExternalTracking - Error en la respuesta:', response.status);
        const errorText = await response.text();
        console.log('📝 DirectTrackingService.findByExternalTracking - Texto de error:', errorText);
        
        return {
          success: false,
          error: `No se encontró información para el tracking: ${trackingNumber}`,
          message: errorText || 'Tracking no encontrado'
        };
      }
      
      const externalData = await response.json();
      console.log('✅ DirectTrackingService.findByExternalTracking - Datos externos encontrados:', externalData);
      
      // Transformar datos externos al formato TrackingInfo
      const trackingInfo: TrackingInfo = {
        trackingNumber: externalData.tracking || trackingNumber,
        packageStatus: externalData.status || 'pending',
        weight: parseFloat(externalData.total_weight) || 0,
        volumetricWeight: parseFloat(externalData.vol_weight) || 0,
        length: parseFloat(externalData.cargo_length) || 0,
        width: parseFloat(externalData.cargo_width) || 0,
        height: parseFloat(externalData.cargo_height) || 0,
        insurance: false,
        shippingStages: [{
          location: externalData.shipper || "Externo",
          photo: "",
          stage: externalData.mode || "Desconocido",
          status: externalData.status_name || "En tránsito",
          updatedTimestamp: externalData.dateupdated || new Date().toISOString()
        }],
        createdAt: externalData.datecreated || new Date().toISOString()
      };
      
      return {
        success: true,
        data: trackingInfo
      };
    } catch (error) {
      console.error('❌ DirectTrackingService.findByExternalTracking - Error:', error);
      
      return {
        success: false,
        error: `Error en la búsqueda externa: ${error instanceof Error ? error.message : 'Error desconocido'}`
      };
    }
  }
  
  /**
   * Busca múltiples trackings basados en una consulta
   * @param query Consulta para buscar trackings
   * @returns Respuesta de la API con datos de múltiples trackings o error
   */
  static async searchTrackings(query: string): Promise<TrackingResponse> {
    console.log('🔍 DirectTrackingService.searchTrackings - Buscando con término:', query);
    
    // Si la consulta parece un número de tracking específico, intentar búsqueda directa
    if (/^[A-Za-z0-9]{6,}$/.test(query.trim())) {
      console.log('🔍 La consulta parece un número de tracking, intentando búsqueda directa');
      const result = await this.findByTracking(query);
      
      // Si encuentra un resultado, convertirlo a array
      if (result.success && result.data) {
        const dataArray = Array.isArray(result.data) ? result.data : [result.data];
        
        // Procesar cada objeto para asegurar que tenga client en lugar de user
        const processedData = dataArray.map(item => {
          // Si el objeto tiene un campo 'user' pero no 'client', transformarlo
          if (item.user && !item.client) {
            console.log('🔄 DirectTrackingService.searchTrackings - Transformando campo "user" a "client" para objeto:', {
              id: item.id,
              trackingNumber: item.trackingNumber
            });
            
            return {
              ...item,
              client: {
                id: item.user.id,
                name: item.user.name,
                email: item.user.email,
                planRate: item.user.planRate || 0,
                photo: item.user.photo,
                planName: item.user.planName,
                branchName: item.user.branchName,
                shipping_insurance: item.user.shipping_insurance
              }
            };
          }
          
          return item;
        });
        
        return {
          success: true,
          data: processedData
        };
      }
      return result;
    }
    
    // Para búsquedas más generales, podríamos implementar una búsqueda en el backend
    // Por ahora, solo devolvemos un error indicando que la búsqueda no está implementada
    return {
      success: false,
      error: 'Búsqueda avanzada no implementada, por favor ingrese un número de tracking específico'
    };
  }
}

export default DirectTrackingService; 