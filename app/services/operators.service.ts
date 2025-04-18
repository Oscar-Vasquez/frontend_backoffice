import { getCookie } from 'cookies-next';
import { AuthService } from './auth.service';
import { convertToPublicUrl } from '@/lib/supabase';
import { getPhotoDisplayUrl } from '@/lib/photo-utils';

export interface Operator {
  operatorId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: string;
  status: string;
  photo?: string | null;
  branchReference?: string | null;
  branchName?: string | null;
  branchAddress?: string | null;
  branchProvince?: string | null;
  branchCity?: string | null;
  type_operator_id?: string | null;
  typeOperatorName?: string | null;
  createdAt: Date;
  updatedAt?: Date | null;
  lastLoginAt?: Date | null;
  birth_date?: Date | string | null;
  hire_date?: Date | string | null;
  personal_id?: string | null;
  address?: string | null;
  emergency_contact?: EmergencyContact | null;
  skills?: string[];
}

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship?: string;
  address?: string;
}

export interface CreateOperatorDto {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  phone?: string;
  photo?: string;
  role?: string;
  status?: string;
  branch_id: string;
  type_operator_id: string;
  birth_date?: string;
  address?: string;
  personal_id?: string;
  gender?: string;
  identificationNumber?: string;
  emergency_contact?: EmergencyContact;
  hire_date?: string;
  skills?: string[];
  notes?: string;
}

export interface UpdateOperatorDto {
  email?: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  phone?: string;
  photo?: string;
  role?: string;
  status?: string;
  branch_id?: string;
  type_operator_id?: string;
  birth_date?: string | null;
  personal_id?: string;
  emergency_contact?: EmergencyContact | null;
  address?: string;
}

export class OperatorsService {
  private static readonly API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  private static operatorsCache: { data: Operator[]; timestamp: number } | null = null;
  private static CACHE_TTL = 60000; // 1 minute cache TTL

  private static async getAuthHeaders() {
    const token = getCookie('workexpress_token');

    if (!token) {
      throw new Error('No hay token de autenticación');
    }

    return {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  static async getOperators(): Promise<Operator[]> {
    try {
      // Check if we have a valid cache
      if (this.operatorsCache && 
          (Date.now() - this.operatorsCache.timestamp < this.CACHE_TTL)) {
        return this.operatorsCache.data;
      }
      
      const token = getCookie('workexpress_token');
      
      if (!token) {
        throw new Error('No hay token de autenticación');
      }
      
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${this.API_URL}/operators`, {
        method: 'GET',
        headers,
        credentials: 'include',
        cache: 'no-store'
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.setItem('redirectAfterLogin', window.location.pathname);
          window.location.href = '/auth/login';
          return [];
        }
        
        throw new Error(`Error al obtener operadores: ${response.status}`);
      }

      const rawData = await response.json();
      
      // Process the data
      let operators: Operator[];
      
      if (!Array.isArray(rawData)) {
        if (rawData && typeof rawData === 'object') {
          // Try to find an array property
          const possibleArrayProps = Object.keys(rawData).filter(key => 
            Array.isArray(rawData[key])
          );
          
          if (possibleArrayProps.length > 0) {
            operators = this.mapOperators(rawData[possibleArrayProps[0]]);
          } else if (rawData.message) {
            throw new Error(rawData.message);
          } else {
            // Try to convert object to array
            const operatorsArray = Object.values(rawData);
            operators = this.mapOperators(operatorsArray);
          }
        } else {
          operators = [];
        }
      } else {
        operators = this.mapOperators(rawData);
      }
      
      // Update cache
      this.operatorsCache = {
        data: operators,
        timestamp: Date.now()
      };
      
      return operators;
    } catch (error) {
      throw error;
    }
  }
  
  private static mapOperators(data: any[]): Operator[] {
    // Map the data to the expected format
    return data.map((item: any) => {
      // Check if the object already has the expected structure
      if (item.operatorId && item.firstName && item.lastName) {
        // Ensure type_operator_id is included
        if (!item.type_operator_id && (item.typeOperatorId || item.type_operator_id)) {
          item.type_operator_id = item.typeOperatorId || item.type_operator_id;
        }
        
        // Asegurar que la foto tenga la URL firmada si está disponible
        if (item.photo) {
          item.photo = getPhotoDisplayUrl(item.photo, item.operatorId);
        }
        
        return item;
      }
      
      const operatorId = item.id || item.operator_id || item.operatorId || '';
      
      // Procesar la foto para usar la URL firmada si está disponible
      const photoUrl = item.photo || null;
      const processedPhotoUrl = photoUrl ? getPhotoDisplayUrl(photoUrl, operatorId) : null;
      
      // Map from a different structure
      return {
        operatorId,
        email: item.email || '',
        firstName: item.first_name || item.firstName || '',
        lastName: item.last_name || item.lastName || '',
        phone: item.phone || '',
        role: item.role || 'unknown',
        status: item.status || 'unknown',
        photo: processedPhotoUrl,
        branchReference: item.branch_id || item.branchId || item.branchReference || null,
        branchName: item.branch_name || item.branchName || null,
        branchAddress: item.branch_address || item.branchAddress || null,
        branchProvince: item.branch_province || item.branchProvince || null,
        branchCity: item.branch_city || item.branchCity || null,
        type_operator_id: item.type_operator_id || item.typeOperatorId || null,
        typeOperatorName: item.type_operator_name || item.typeOperatorName || null,
        createdAt: item.created_at ? new Date(item.created_at) : item.createdAt ? new Date(item.createdAt) : new Date(),
        updatedAt: item.updated_at ? new Date(item.updated_at) : item.updatedAt ? new Date(item.updatedAt) : null,
        lastLoginAt: item.last_login_at ? new Date(item.last_login_at) : item.lastLoginAt ? new Date(item.lastLoginAt) : null,
        // Campos adicionales
        birth_date: item.birth_date || item.birthdate || null,
        hire_date: item.hire_date || item.hireDate || null,
        personal_id: item.personal_id || item.personalId || null,
        address: item.address || null,
        emergency_contact: item.emergency_contact || item.emergencyContact || null,
        skills: item.skills || []
      };
    });
  }

  static async getOperator(id: string): Promise<Operator> {
    try {
      // Invalidar caché para garantizar que obtenemos datos frescos con todos los campos
      this.operatorsCache = null;
      
      // Check if we have a cached list of operators
      if (this.operatorsCache && 
          (Date.now() - this.operatorsCache.timestamp < this.CACHE_TTL)) {
        // Try to find the operator in the cache
        const cachedOperator = this.operatorsCache.data.find(op => op.operatorId === id);
        if (cachedOperator) {
          return cachedOperator;
        }
      }
      
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${this.API_URL}/operators/${id}?refresh=true`, {
        method: 'GET',
        headers,
        credentials: 'include',
        cache: 'no-store'
      });

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/auth/login';
          throw new Error('No autenticado');
        }
        throw new Error(`Error al obtener operador: ${response.status}`);
      }

      const data = await response.json();
      
      // Log para depuración - verificar que se reciben los campos adicionales
      console.log('Datos del operador recibidos del backend:', data);
      console.log('Campos adicionales encontrados:', {
        birth_date: data.birth_date || data.birthdate || 'No presente',
        hire_date: data.hire_date || data.hireDate || 'No presente',
        personal_id: data.personal_id || data.personalId || 'No presente',
        address: data.address || 'No presente',
        emergency_contact: data.emergency_contact || data.emergencyContact || 'No presente',
        skills: data.skills || 'No presente'
      });
      
      // Mapear la respuesta al formato Operator asegurando que todos los campos estén incluidos
      const mappedOperator: Operator = {
        operatorId: data.operatorId || data.id || id,
        email: data.email || '',
        firstName: data.firstName || data.first_name || '',
        lastName: data.lastName || data.last_name || '',
        phone: data.phone || '',
        role: data.role || '',
        status: data.status || '',
        photo: data.photo || null,
        branchReference: data.branchReference || data.branch_id || null,
        branchName: data.branchName || data.branch_name || null,
        branchAddress: data.branchAddress || data.branch_address || null,
        branchProvince: data.branchProvince || data.branch_province || null,
        branchCity: data.branchCity || data.branch_city || null,
        type_operator_id: data.type_operator_id || data.typeOperatorId || null,
        typeOperatorName: data.typeOperatorName || data.type_operator_name || null,
        createdAt: data.createdAt ? new Date(data.createdAt) : data.created_at ? new Date(data.created_at) : new Date(),
        updatedAt: data.updatedAt ? new Date(data.updatedAt) : data.updated_at ? new Date(data.updated_at) : null,
        lastLoginAt: data.lastLoginAt ? new Date(data.lastLoginAt) : data.last_login_at ? new Date(data.last_login_at) : null,
        // Campos adicionales
        birth_date: data.birth_date || data.birthdate || null,
        hire_date: data.hire_date || data.hireDate || null,
        personal_id: data.personal_id || data.personalId || null,
        address: data.address || null,
        emergency_contact: data.emergency_contact || data.emergencyContact || null,
        skills: data.skills || []
      };
      
      return mappedOperator;
    } catch (error) {
      throw error;
    }
  }

  static async createOperator(data: CreateOperatorDto): Promise<Operator> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${this.API_URL}/operators`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/auth/login';
          throw new Error('No autenticado');
        }
        
        const errorText = await response.text();
        throw new Error(errorText || `Error al crear operador: ${response.status}`);
      }

      const responseData = await response.json();
      
      // Invalidate cache
      this.operatorsCache = null;
      
      return responseData;
    } catch (error) {
      throw error;
    }
  }

  static async updateOperator(id: string, data: UpdateOperatorDto): Promise<Operator> {
    try {
      console.log('🔄 OperatorsService: Iniciando actualización de operador:', id, data);
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${this.API_URL}/operators/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(data),
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.setItem('redirectAfterLogin', window.location.pathname);
          window.location.href = '/auth/login';
          throw new Error('No autenticado');
        }
        
        // Intentar obtener más detalles del error
        let errorMessage = `Error al actualizar operador: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (parseError) {
          console.error('No se pudo parsear la respuesta de error:', parseError);
        }
        
        throw new Error(errorMessage);
      }

      const updatedOperator = await response.json();
      console.log('✅ OperatorsService: Respuesta del servidor:', updatedOperator);
      
      // Comprobar si la respuesta del servidor es válida
      if (!updatedOperator) {
        console.error('❌ OperatorsService: Respuesta del servidor vacía');
        throw new Error('La respuesta del servidor está vacía');
      }
      
      // Usar el método mapOperator que hemos implementado
      const mappedOperator = this.mapOperator(updatedOperator);
      console.log('✅ OperatorsService: Operador mapeado:', mappedOperator);
      
      return mappedOperator;
    } catch (error) {
      console.error(`❌ OperatorsService: Error al actualizar operador ${id}:`, error);
      throw error;
    }
  }

  /**
   * Mapea un objeto de operador de la API a un objeto Operator del cliente
   */
  static mapOperator(data: any): Operator {
    if (!data) return {} as Operator;
    
    console.log('🔄 Mapeando datos de operador:', data);
    
    return {
      operatorId: data.operatorId || data.id || '',
      email: data.email || '',
      firstName: data.firstName || data.first_name || '',
      lastName: data.lastName || data.last_name || '',
      phone: data.phone || '',
      role: data.role || '',
      status: data.status || '',
      photo: data.photo || null,
      branchReference: data.branchReference || data.branch_id || null,
      branchName: data.branchName || data.branch_name || null,
      branchAddress: data.branchAddress || data.branch_address || null,
      branchProvince: data.branchProvince || data.branch_province || null,
      branchCity: data.branchCity || data.branch_city || null,
      type_operator_id: data.type_operator_id || data.typeOperatorId || null,
      typeOperatorName: data.typeOperatorName || data.type_operator_name || null,
      createdAt: data.createdAt ? new Date(data.createdAt) : data.created_at ? new Date(data.created_at) : new Date(),
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : data.updated_at ? new Date(data.updated_at) : null,
      lastLoginAt: data.lastLoginAt ? new Date(data.lastLoginAt) : data.last_login_at ? new Date(data.last_login_at) : null,
      // Campos adicionales
      birth_date: data.birth_date || data.birthdate || null,
      hire_date: data.hire_date || data.hireDate || null,
      personal_id: data.personal_id || data.personalId || null,
      address: data.address || null,
      emergency_contact: data.emergency_contact || data.emergencyContact || null,
      skills: data.skills || []
    };
  }

  static async changePassword(id: string, data: { password: string, currentPassword: string }): Promise<boolean> {
    try {
      const headers = await this.getAuthHeaders();
      
      // Usar el endpoint específico para cambiar contraseñas
      const response = await fetch(`${this.API_URL}/operators/${id}/change-password`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('No autenticado');
        }
        
        if (response.status === 403) {
          throw new Error('No tienes permisos para cambiar esta contraseña. Solo puedes cambiar tu propia contraseña.');
        }
        
        if (response.status === 400) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Contraseña actual incorrecta');
        }
        
        // Intentar obtener un mensaje de error más descriptivo
        try {
          const errorResponse = await response.json();
          if (errorResponse.message) {
            throw new Error(`Error al cambiar contraseña: ${errorResponse.message}`);
          }
        } catch (parseError) {
          // Si no podemos parsear la respuesta, usar el código de estado
          throw new Error(`Error al cambiar contraseña: ${response.status}`);
        }
      }

      return true;
    } catch (error) {
      console.error(`❌ Error al cambiar contraseña del operador ${id}:`, error);
      throw error;
    }
  }

  static async deleteOperator(id: string): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${this.API_URL}/operators/${id}`, {
        method: 'DELETE',
        headers,
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/auth/login';
          throw new Error('No autenticado');
        }
        throw new Error(`Error al eliminar operador: ${response.status}`);
      }
      
      // Invalidate cache
      this.operatorsCache = null;
    } catch (error) {
      throw error;
    }
  }

  static async inviteOperator(data: { email: string; role: string; message?: string }): Promise<any> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${this.API_URL}/operators/invite`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/auth/login';
          throw new Error('No autenticado');
        }
        
        const errorText = await response.text();
        throw new Error(errorText || `Error al invitar operador: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  }

  static async diagnosticarConexion(): Promise<{
    apiUrl: string;
    tokenPresente: boolean;
    tokenParcial?: string;
    cookies: string[];
    conectividadApi: boolean;
    respuestaOperadores: {
      status: number;
      ok: boolean;
      mensaje?: string;
    };
  }> {
    const apiUrl = this.API_URL;
    let tokenPresente = false;
    let tokenParcial = undefined;
    let cookies: string[] = [];
    let conectividadApi = false;
    let respuestaOperadores = {
      status: 0,
      ok: false,
      mensaje: ''
    };
    
    // Verificar token
    try {
      const token = getCookie('workexpress_token');
      tokenPresente = !!token;
      if (token && typeof token === 'string') {
        tokenParcial = token.substring(0, 10) + '...';
      }
    } catch (error) {
      tokenPresente = false;
    }
    
    // Obtener cookies
    try {
      document.cookie.split(';').forEach(cookie => {
        cookies.push(cookie.trim());
      });
    } catch (error) {
      cookies = ['Error al obtener cookies'];
    }
    
    // Verificar conectividad con el API
    try {
      const response = await fetch(`${apiUrl}/health`, {
        method: 'GET',
        cache: 'no-store'
      });
      
      conectividadApi = response.ok;
    } catch (error) {
      conectividadApi = false;
    }
    
    // Verificar respuesta de operadores
    try {
      const token = getCookie('workexpress_token');
      const headers: Record<string, string> = {};
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${apiUrl}/operators`, {
        method: 'GET',
        headers,
        credentials: 'include',
        cache: 'no-store'
      });
      
      respuestaOperadores = {
        status: response.status,
        ok: response.ok,
        mensaje: response.ok ? 'OK' : `Error ${response.status}: ${response.statusText}`
      };
      
      if (!response.ok) {
        try {
          const errorText = await response.text();
          respuestaOperadores.mensaje = errorText;
        } catch (e) {
          // Ignorar error al leer el texto
        }
      }
    } catch (error) {
      respuestaOperadores = {
        status: 0,
        ok: false,
        mensaje: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
    
    return {
      apiUrl,
      tokenPresente,
      tokenParcial,
      cookies,
      conectividadApi,
      respuestaOperadores
    };
  }

  /**
   * Método especializado para actualizar un operador con una foto
   * Este método maneja adecuadamente el procesamiento de la imagen
   */
  static async updateOperatorWithPhoto(id: string, data: UpdateOperatorDto & { _imageData?: string }): Promise<Operator> {
    try {
      // Invalidar caché antes de hacer la petición
      this.operatorsCache = null;
      
      // Obtener token
      const token = getCookie('workexpress_token');
      if (!token) {
        throw new Error('No hay token de autenticación');
      }
      
      // Extraer los datos de la imagen si están presentes
      const imageData = data._imageData;
      const cleanData = { ...data };
      
      // Eliminar el campo temporal antes de enviar
      if ('_imageData' in cleanData) {
        delete cleanData._imageData;
      }
      
      // Eliminar campos vacíos o indefinidos
      Object.keys(cleanData).forEach(key => {
        if (cleanData[key] === undefined || cleanData[key] === null || cleanData[key] === '') {
          delete cleanData[key];
        }
      });
      
      // Log para diagnóstico
      console.log('🔍 updateOperatorWithPhoto - Datos a enviar:', cleanData);
      
      // Asegurar que se incluyan los campos obligatorios para validación
      try {
        // Intentar obtener el operador existente para incluir campos obligatorios si faltan
        const existingOperator = await this.getOperator(id);
        
        // Siempre incluir email, firstName y lastName para validación
        if (!cleanData.email && existingOperator.email) {
          cleanData.email = existingOperator.email;
          console.log('✅ Añadido email desde operador existente:', cleanData.email);
        }
        
        if (!cleanData.firstName && existingOperator.firstName) {
          cleanData.firstName = existingOperator.firstName;
          console.log('✅ Añadido firstName desde operador existente:', cleanData.firstName);
        }
        
        if (!cleanData.lastName && existingOperator.lastName) {
          cleanData.lastName = existingOperator.lastName;
          console.log('✅ Añadido lastName desde operador existente:', cleanData.lastName);
        }
        
        // IMPORTANTE: Siempre incluir el rol para que el backend no lo omita
        if (!cleanData.role && existingOperator.role) {
          cleanData.role = existingOperator.role;
          console.log('✅ Añadido role desde operador existente:', cleanData.role);
        }
        
        // Verificar si se incluye una URL de foto
        if (cleanData.photo && typeof cleanData.photo === 'string') {
          // Convertir URL de Supabase si tiene formato incorrecto
          if (cleanData.photo.includes('/sign/')) {
            cleanData.photo = convertToPublicUrl(cleanData.photo);
            console.log('📷 URL convertida a formato público:', cleanData.photo);
          } 
          // Eliminar tokens de firma si existen
          else if (cleanData.photo.includes('?')) {
            cleanData.photo = cleanData.photo.split('?')[0];
            console.log('📷 URL limpiada (sin token):', cleanData.photo);
          }
        }
      } catch (error) {
        console.warn('⚠️ No se pudieron obtener datos del operador existente:', error);
      }
      
      // Asegurarse de que el rol se incluye correctamente
      if (cleanData.role) {
        console.log('👑 updateOperatorWithPhoto - Rol específico:', cleanData.role);
        
        // Verificar que el rol sea uno de los permitidos por el backend
        const allowedRoles = ['admin', 'manager', 'staff', 'guest', 'Contador', 'gerente_de_sucursal', 'programador'];
        if (!allowedRoles.includes(cleanData.role)) {
          console.warn(`⚠️ Advertencia: El rol "${cleanData.role}" no está en la lista de roles permitidos: ${allowedRoles.join(', ')}`);
          
          try {
            // Obtener el rol actual del operador para usarlo como referencia
            const existingOperator = await this.getOperator(id);
            if (existingOperator && existingOperator.role && allowedRoles.includes(existingOperator.role)) {
              // Si el operador ya tiene un rol permitido, mantenerlo
              cleanData.role = existingOperator.role;
              console.log(`👑 Manteniendo el rol actual del operador: "${cleanData.role}"`);
            } else {
              // Si no tiene un rol permitido o no se puede determinar, usar staff
              cleanData.role = 'staff';
              console.log('👑 Rol corregido a "staff" para cumplir con los requisitos del backend');
            }
          } catch (error) {
            // Si hay error al obtener el operador actual, usar valor seguro
            cleanData.role = 'staff';
            console.log('👑 Error al obtener operador, rol corregido a "staff"');
          }
        } else {
          console.log(`👑 Rol "${cleanData.role}" es válido para el backend`);
        }
      } else {
        // Si no se especificó rol, usar 'staff' como valor predeterminado
        cleanData.role = 'staff';
        console.log('👑 Rol no especificado, asignando valor por defecto: "staff"');
      }
      
      // Si tenemos datos de imagen, necesitamos subirla a Supabase primero
      if (imageData) {
        console.log('Imagen detectada, procesando para subir a Supabase');
        
        try {
          // Convertir el base64 en un Blob para subirlo
          const base64Response = await fetch(imageData);
          const blob = await base64Response.blob();
          
          // Crear un objeto File con un nombre temporal
          const file = new File([blob], `operator_${id}_${Date.now()}.jpg`, { 
            type: 'image/jpeg' 
          });
          
          // Importar la función de supabase.ts para subir el archivo
          const { uploadFileToSupabase } = await import('@/lib/supabase');
          
          // Subir la imagen a Supabase
          const { url, error } = await uploadFileToSupabase(
            file, 
            'workexpressimagedata', 
            'operators'
          );
          
          if (error) {
            throw error;
          }
          
          if (!url) {
            throw new Error('No se pudo obtener la URL de la imagen después de subirla');
          }
          
          console.log('URL de la imagen obtenida:', url);
          
          // Procesar la URL para asegurar compatibilidad con backend
          let processedUrl = url;
          
          // Convertir URL con '/sign/' a '/public/' si es necesario
          if (processedUrl.includes('/sign/')) {
            processedUrl = convertToPublicUrl(processedUrl);
            console.log('URL convertida a formato público:', processedUrl);
          }
          
          // Eliminar parámetros de consulta si existen
          if (processedUrl.includes('?')) {
            processedUrl = processedUrl.split('?')[0];
            console.log('URL limpiada (sin tokens):', processedUrl);
          }
          
          // Actualizar el DTO con la URL procesada
          cleanData.photo = processedUrl;
          console.log('URL final para el backend:', cleanData.photo);
        } catch (imageError) {
          console.error('Error al procesar y subir la imagen:', imageError);
          throw new Error(`Error al procesar la imagen: ${imageError instanceof Error ? imageError.message : 'Error desconocido'}`);
        }
      }
      
      // Forzar una versión directa a la API para asegurar que todos los campos se envían correctamente
      console.log('Enviando actualización directa a la API...');
      const url = `${this.API_URL}/operators/${id}`;
      
      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
      
      // Contenido final que se enviará
      console.log('URL de la solicitud:', url);
      console.log('Headers:', headers);
      console.log('Body de la solicitud:', JSON.stringify(cleanData, null, 2));
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: headers,
        body: JSON.stringify(cleanData),
        credentials: 'include',
        cache: 'no-store'
      });
      
      console.log('Código de estado de la respuesta:', response.status);
      
      if (!response.ok) {
        const responseText = await response.text();
        console.error('Error en respuesta del servidor:', responseText);
        
        // Si hay un error específico de validación, intentar una actualización de respaldo
        if (response.status === 400 && responseText.includes('validation')) {
          console.log('⚠️ Error de validación detectado, intentando método de respaldo...');
          
          // Crear un DTO minimal con sólo los campos absolutamente necesarios
          const minimalDTO = {
            firstName: cleanData.firstName || '',
            lastName: cleanData.lastName || '',
            email: cleanData.email || '',
            role: cleanData.role || 'staff'
          };
          
          console.log('Intentando actualización mínima con:', minimalDTO);
          
          const backupResponse = await fetch(url, {
            method: 'PATCH',
            headers: headers,
            body: JSON.stringify(minimalDTO),
            credentials: 'include',
            cache: 'no-store'
          });
          
          if (!backupResponse.ok) {
            const backupError = await backupResponse.text();
            throw new Error(backupError || `Error en método de respaldo: ${backupResponse.status}`);
          }
          
          // Leer la respuesta como texto
          const backupText = await backupResponse.text();
          
          let backupData;
          try {
            // Parsear la respuesta
            backupData = JSON.parse(backupText);
            console.log('Respuesta del método de respaldo:', backupData);
          } catch (e) {
            console.error('Error al parsear respuesta JSON del método de respaldo:', e);
            throw new Error(`Error al procesar respuesta: ${e.message}`);
          }
          
          // Mapear respuesta al formato Operator
          const updatedOperator = this.mapOperatorResponse(backupData, id, minimalDTO);
          
          // Forzar recarga
          setTimeout(() => { this.operatorsCache = null; }, 100);
          
          return updatedOperator;
        }
        
        throw new Error(responseText || `Error al actualizar operador: ${response.status}`);
      }
      
      // Obtener la respuesta como texto primero para diagnóstico
      const responseText = await response.text();
      console.log('Respuesta del servidor (text):', responseText);
      
      // Parsear la respuesta
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Error al parsear respuesta JSON:', parseError);
        throw new Error(`Error al procesar respuesta del servidor: ${parseError instanceof Error ? parseError.message : 'Error desconocido'}`);
      }
      
      // Mapear respuesta al formato Operator
      const updatedOperator = this.mapOperatorResponse(responseData, id, cleanData);
      
      // Verificar que el rol se actualizó correctamente
      console.log('Rol en la respuesta:', responseData.role);
      console.log('Rol mapeado en el objeto de respuesta:', updatedOperator.role);
      
      // Forzar recarga de datos después de actualización
      setTimeout(() => {
        this.operatorsCache = null;
      }, 100);
      
      return updatedOperator;
    } catch (error) {
      console.error('Error en updateOperatorWithPhoto:', error);
      throw error;
    }
  }
  
  // Método auxiliar para mapear respuestas a formato Operator
  private static mapOperatorResponse(responseData: any, id: string, data: any): Operator {
    const operatorId = responseData.id || responseData.operatorId || id;
    
    console.log('🔍 Datos originales en mapOperatorResponse:', {
      responseData,
      data
    });
    
    // Obtener birth_date con prioridad en este orden
    let birthDate = null;
    if (responseData.birth_date) {
      console.log('Usando birth_date de la respuesta:', responseData.birth_date);
      try {
        birthDate = responseData.birth_date;
      } catch (e) {
        console.error('Error al procesar birth_date:', e);
      }
    } else if (responseData.birthdate) {
      console.log('Usando birthdate de la respuesta:', responseData.birthdate);
      birthDate = responseData.birthdate;
    } else if (data.birth_date) {
      console.log('Usando birth_date de los datos enviados:', data.birth_date);
      birthDate = data.birth_date;
    }
    
    // Obtener emergency_contact
    let emergencyContact = null;
    if (responseData.emergency_contact) {
      console.log('Usando emergency_contact de la respuesta:', responseData.emergency_contact);
      emergencyContact = responseData.emergency_contact;
    } else if (responseData.emergencyContact) {
      console.log('Usando emergencyContact de la respuesta:', responseData.emergencyContact);
      emergencyContact = responseData.emergencyContact;
    } else if (data.emergency_contact) {
      console.log('Usando emergency_contact de los datos enviados:', data.emergency_contact);
      emergencyContact = data.emergency_contact;
    }
    
    // Procesar la foto para usar URL firmada si está disponible
    const photoUrl = responseData.photo || data.photo || null;
    const processedPhotoUrl = photoUrl ? getPhotoDisplayUrl(photoUrl, operatorId) : null;
    
    // Crear el objeto con los campos procesados
    return {
      operatorId,
      email: responseData.email || data.email || '',
      firstName: responseData.first_name || responseData.firstName || data.firstName || '',
      lastName: responseData.last_name || responseData.lastName || data.lastName || '',
      phone: responseData.phone || data.phone || '',
      role: responseData.role || data.role || '',
      status: responseData.status || data.status || '',
      photo: processedPhotoUrl,
      branchReference: responseData.branch_id || responseData.branchReference || data.branch_id || null,
      branchName: responseData.branch_name || responseData.branchName || null,
      branchAddress: responseData.branch_address || responseData.branchAddress || null,
      branchProvince: responseData.branch_province || responseData.branchProvince || null,
      branchCity: responseData.branch_city || responseData.branchCity || null,
      type_operator_id: responseData.type_operator_id || responseData.typeOperatorId || data.type_operator_id || null,
      typeOperatorName: responseData.typeOperatorName || responseData.type_operator_name || null,
      createdAt: new Date(responseData.created_at || responseData.createdAt || new Date()),
      updatedAt: new Date(responseData.updated_at || responseData.updatedAt || new Date()),
      lastLoginAt: responseData.last_login_at || responseData.lastLoginAt ? new Date(responseData.last_login_at || responseData.lastLoginAt) : null,
      // Campos adicionales
      birth_date: birthDate,
      hire_date: responseData.hire_date || responseData.hireDate || data.hire_date || data.hireDate || null,
      personal_id: responseData.personal_id || responseData.personalId || data.personal_id || data.personalId || null,
      address: responseData.address || data.address || null,
      emergency_contact: emergencyContact,
      skills: responseData.skills || data.skills || []
    };
  }
} 