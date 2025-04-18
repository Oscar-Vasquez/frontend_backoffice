'use client';

import { API_URL } from '@/app/config';
import { AuthService } from './auth.service';

export interface OperatorType {
  id: string;
  name: string;
  description?: string;
  permissions?: Record<string, boolean>;
  created_at: Date;
  updated_at?: Date;
}

interface CreateOperatorTypeDto {
  name: string;
  description?: string;
  permissions?: Record<string, boolean>;
}

interface UpdateOperatorTypeDto {
  name?: string;
  description?: string;
  permissions?: Record<string, boolean>;
}

export class OperatorTypesService {
  private static getHeaders() {
    const token = AuthService.getToken();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }

  static async getOperatorTypes(): Promise<OperatorType[]> {
    try {
      const response = await fetch(`${API_URL}/operator-types`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al obtener los tipos de operadores');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching operator types:', error);
      throw error;
    }
  }

  static async getOperatorType(id: string): Promise<OperatorType> {
    try {
      const response = await fetch(`${API_URL}/operator-types/${id}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al obtener el tipo de operador');
      }

      return await response.json();
    } catch (error) {
      console.error(`Error fetching operator type with id ${id}:`, error);
      throw error;
    }
  }

  static async createOperatorType(data: CreateOperatorTypeDto): Promise<OperatorType> {
    try {
      const response = await fetch(`${API_URL}/operator-types`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al crear el tipo de operador');
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating operator type:', error);
      throw error;
    }
  }

  static async updateOperatorType(id: string, data: UpdateOperatorTypeDto): Promise<OperatorType> {
    try {
      const response = await fetch(`${API_URL}/operator-types/${id}`, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al actualizar el tipo de operador');
      }

      return await response.json();
    } catch (error) {
      console.error(`Error updating operator type with id ${id}:`, error);
      throw error;
    }
  }

  static async deleteOperatorType(id: string): Promise<void> {
    try {
      const response = await fetch(`${API_URL}/operator-types/${id}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al eliminar el tipo de operador');
      }
    } catch (error) {
      console.error(`Error deleting operator type with id ${id}:`, error);
      throw error;
    }
  }

  static async getOperatorPermissions(operatorId?: string): Promise<Record<string, boolean>> {
    try {
      // If no operatorId is provided, use the current operator
      const operator = operatorId ? { id: operatorId } : AuthService.getOperatorData();
      console.log('🔍 Obteniendo permisos para operador:', operator);
      
      // If operator is admin, return all permissions as true
      if (operator?.role?.toLowerCase() === 'admin' || 
          operator?.role?.toLowerCase().includes('admin')) {
        console.log('✅ Usuario es administrador, todos los permisos concedidos');
        return {
          home: true,
          tracking: true,
          billing: true,
          invoices: true,
          clients: true,
          operators: true,
          operator_types: true,
          plans: true,
          branches: true,
          emails: true,
        };
      }

      // Verificar type_operator_id en todas las posibles propiedades
      const typeOperatorId = operator?.type_operator_id || operator?.typeOperatorId;
      console.log('🔍 ID del tipo de operador:', typeOperatorId);

      // If operator has no type_operator_id, return basic permissions
      if (!typeOperatorId) {
        console.log('⚠️ Usuario no tiene type_operator_id, asignando permisos básicos');
        return {
          home: true,
          // Si el rol incluye "gerente", dar acceso a algunas secciones básicas
          ...(operator?.role?.toLowerCase().includes('gerente') ? {
            tracking: true,
            billing: true,
            invoices: true,
            clients: true,
            branches: true,
          } : {})
        };
      }

      // Check if the typeOperatorId is the placeholder UUID
      if (typeOperatorId === '3fa85f64-5717-4562-b3fc-2c963f66afa6') {
        console.log('⚠️ ID del tipo de operador es un placeholder, asignando permisos básicos');
        return {
          home: true,
          // Si el rol incluye "gerente", dar acceso a algunas secciones básicas
          ...(operator?.role?.toLowerCase().includes('gerente') ? {
            tracking: true,
            billing: true,
            invoices: true,
            clients: true,
            branches: true,
          } : {})
        };
      }

      // Get operator type permissions
      try {
        console.log('🔍 Obteniendo tipo de operador con ID:', typeOperatorId);
        const operatorType = await this.getOperatorType(typeOperatorId);
        console.log('📋 Tipo de operador obtenido:', operatorType);
        
        // Corregir posibles errores en los nombres de los permisos
        const permissions = operatorType.permissions || {};
        
        // Corregir "traking" a "tracking" si existe
        if (permissions.traking && !permissions.tracking) {
          permissions.tracking = permissions.traking;
        }
        
        console.log('🔑 Permisos finales:', permissions);
        return permissions;
      } catch (error) {
        console.error('❌ Error al obtener tipo de operador:', error);
        // Si hay un error al obtener el tipo de operador, asignar permisos básicos
        return {
          home: true,
          // Si el rol incluye "gerente", dar acceso a algunas secciones básicas
          ...(operator?.role?.toLowerCase().includes('gerente') ? {
            tracking: true,
            billing: true,
            invoices: true,
            clients: true,
            branches: true,
          } : {})
        };
      }
    } catch (error) {
      console.error('❌ Error al obtener permisos:', error);
      // Devolver permisos básicos en caso de error
      return {
        home: true
      };
    }
  }
} 