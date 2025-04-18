'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Package, 
  MapPin, 
  Calendar, 
  Truck, 
  Info, 
  Clock,
  ClipboardCheck,
  User,
  Shield,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CombinedTrackingInfo } from '../types';
import { StatusBadge } from './StatusBadge';

interface TrackingDetailsProps {
  tracking: CombinedTrackingInfo;
  themeColor: string;
}

/**
 * Componente que muestra los detalles del envío
 * Presenta información organizada del seguimiento del paquete
 */
const TrackingDetails: React.FC<TrackingDetailsProps> = ({ 
  tracking,
  themeColor
}) => {
  if (!tracking) return null;
  
  // Formatea la fecha en español
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return format(date, 'dd MMM yyyy, HH:mm', { locale: es });
    } catch (e) {
      return dateString;
    }
  };

  // Función auxiliar para verificar si el cliente tiene seguro
  const hasInsurance = (): boolean => {
    if (!tracking.client) return false;
    
    const insurance = tracking.client.shipping_insurance as boolean | string | number | undefined;
    if (typeof insurance === 'boolean') return insurance;
    if (typeof insurance === 'string') {
      const lowerValue = insurance.toLowerCase();
      return lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes';
    }
    if (typeof insurance === 'number') return insurance === 1;
    return false;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full"
    >
      {/* Estado del envío */}
      <div className="mb-6">
        <StatusBadge 
          status={tracking.trackingStatus} 
          size="lg"
          className="px-3 py-1.5"
          solid
          gradient
          tooltip={`Estado actual: ${tracking.trackingStatus || 'En proceso'}`}
        />
      </div>
      
      {/* Información del paquete */}
      <Card className="mb-6 border-none shadow-md overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 pb-2">
          <div className="flex items-center">
            <Package className="mr-2 h-5 w-5 text-blue-500" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Información del envío</h3>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-start">
                <span className="text-gray-500 dark:text-gray-400 w-32 flex-shrink-0">Tracking:</span>
                <span className="font-medium text-gray-800 dark:text-white">{tracking.trackingNumber}</span>
              </div>
              <div className="flex items-start">
                <span className="text-gray-500 dark:text-gray-400 w-32 flex-shrink-0">Carrier:</span>
                <span className="font-medium text-gray-800 dark:text-white">{tracking.carrier || 'No especificado'}</span>
              </div>
              <div className="flex items-start">
                <span className="text-gray-500 dark:text-gray-400 w-32 flex-shrink-0">Servicio:</span>
                <span className="font-medium text-gray-800 dark:text-white">{tracking.service || 'Estándar'}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-start">
                <span className="text-gray-500 dark:text-gray-400 w-32 flex-shrink-0">Fecha de envío:</span>
                <span className="font-medium text-gray-800 dark:text-white">
                  {formatDate(tracking.shipDate || '')}
                </span>
              </div>
              <div className="flex items-start">
                <span className="text-gray-500 dark:text-gray-400 w-32 flex-shrink-0">Entrega estimada:</span>
                <span className="font-medium text-gray-800 dark:text-white">
                  {formatDate(tracking.estimatedDeliveryDate || '')}
                </span>
              </div>
              {/* Información de seguro de envío */}
              {tracking.client && (
                <div className="flex items-start">
                  <span className="text-gray-500 dark:text-gray-400 w-32 flex-shrink-0 flex items-center">
                    <Shield className="mr-1 h-3.5 w-3.5" /> Seguro:
                  </span>
                  <span className={`font-medium ${hasInsurance() ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                    {hasInsurance() ? 'Incluido' : 'No incluido'}
                  </span>
                </div>
              )}
              {/* Valor declarado */}
              {tracking.declared_value && (
                <div className="flex items-start">
                  <span className="text-gray-500 dark:text-gray-400 w-32 flex-shrink-0 flex items-center">
                    <FileText className="mr-1 h-3.5 w-3.5" /> Valor declarado:
                  </span>
                  <span className="font-medium text-gray-800 dark:text-white">
                    {typeof tracking.declared_value === 'number' 
                      ? `$${tracking.declared_value.toFixed(2)} USD`
                      : tracking.declared_value}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          {tracking.trackingEvents && tracking.trackingEvents.length > 0 && (
            <>
              <Separator className="my-4" />
              <div className="mt-4">
                <h4 className="font-medium text-gray-800 dark:text-white mb-3 flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  Últimas actualizaciones
                </h4>
                
                <div className="space-y-4">
                  {tracking.trackingEvents.slice(0, 3).map((event, index) => (
                    <div key={index} className="pl-4 border-l-2 border-blue-200 dark:border-blue-800">
                      <p className="text-sm font-medium text-gray-800 dark:text-white">{event.status || 'Actualización'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(event.date)}</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{event.location || 'No disponible'}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      
      {/* Información de origen y destino */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Origen */}
        <Card className="border-none shadow-md overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 pb-2">
            <div className="flex items-center">
              <MapPin className="mr-2 h-5 w-5 text-blue-500" />
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Origen</h3>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-2">
              {tracking.originAddress && (
                <div className="flex items-start">
                  <span className="text-gray-500 dark:text-gray-400 w-24 flex-shrink-0">Dirección:</span>
                  <span className="font-medium text-gray-800 dark:text-white">{tracking.originAddress}</span>
                </div>
              )}
              {tracking.originCity && (
                <div className="flex items-start">
                  <span className="text-gray-500 dark:text-gray-400 w-24 flex-shrink-0">Ciudad:</span>
                  <span className="font-medium text-gray-800 dark:text-white">{tracking.originCity}</span>
                </div>
              )}
              {tracking.originCountry && (
                <div className="flex items-start">
                  <span className="text-gray-500 dark:text-gray-400 w-24 flex-shrink-0">País:</span>
                  <span className="font-medium text-gray-800 dark:text-white">{tracking.originCountry}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Destino */}
        <Card className="border-none shadow-md overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 pb-2">
            <div className="flex items-center">
              <MapPin className="mr-2 h-5 w-5 text-indigo-500" />
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Destino</h3>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-2">
              {tracking.destinationAddress && (
                <div className="flex items-start">
                  <span className="text-gray-500 dark:text-gray-400 w-24 flex-shrink-0">Dirección:</span>
                  <span className="font-medium text-gray-800 dark:text-white">{tracking.destinationAddress}</span>
                </div>
              )}
              {tracking.destinationCity && (
                <div className="flex items-start">
                  <span className="text-gray-500 dark:text-gray-400 w-24 flex-shrink-0">Ciudad:</span>
                  <span className="font-medium text-gray-800 dark:text-white">{tracking.destinationCity}</span>
                </div>
              )}
              {tracking.destinationCountry && (
                <div className="flex items-start">
                  <span className="text-gray-500 dark:text-gray-400 w-24 flex-shrink-0">País:</span>
                  <span className="font-medium text-gray-800 dark:text-white">{tracking.destinationCountry}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Información adicional */}
      {(tracking.weight || tracking.dimensions || tracking.packageItems) && (
        <Card className="mb-6 border-none shadow-md overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-gray-800 dark:to-gray-700 pb-2">
            <div className="flex items-center">
              <ClipboardCheck className="mr-2 h-5 w-5 text-indigo-500" />
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Detalles del paquete</h3>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {tracking.weight && (
                <div className="flex items-start">
                  <span className="text-gray-500 dark:text-gray-400 w-24 flex-shrink-0">Peso:</span>
                  <span className="font-medium text-gray-800 dark:text-white">{tracking.weight}</span>
                </div>
              )}
              {tracking.dimensions && (
                <div className="flex items-start">
                  <span className="text-gray-500 dark:text-gray-400 w-24 flex-shrink-0">Dimensiones:</span>
                  <span className="font-medium text-gray-800 dark:text-white">{tracking.dimensions}</span>
                </div>
              )}
              {tracking.packageItems && (
                <div className="flex items-start">
                  <span className="text-gray-500 dark:text-gray-400 w-24 flex-shrink-0">Artículos:</span>
                  <span className="font-medium text-gray-800 dark:text-white">{tracking.packageItems}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Información de destinatario */}
      {tracking.recipientName && (
        <Card className="mb-6 border-none shadow-md overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-700 pb-2">
            <div className="flex items-center">
              <User className="mr-2 h-5 w-5 text-purple-500" />
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Destinatario</h3>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-2">
              <div className="flex items-start">
                <span className="text-gray-500 dark:text-gray-400 w-24 flex-shrink-0">Nombre:</span>
                <span className="font-medium text-gray-800 dark:text-white">{tracking.recipientName}</span>
              </div>
              {tracking.recipientPhone && (
                <div className="flex items-start">
                  <span className="text-gray-500 dark:text-gray-400 w-24 flex-shrink-0">Teléfono:</span>
                  <span className="font-medium text-gray-800 dark:text-white">{tracking.recipientPhone}</span>
                </div>
              )}
              {tracking.recipientEmail && (
                <div className="flex items-start">
                  <span className="text-gray-500 dark:text-gray-400 w-24 flex-shrink-0">Email:</span>
                  <span className="font-medium text-gray-800 dark:text-white">{tracking.recipientEmail}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Botón de acción */}
      <div className="w-full flex justify-center mt-8">
        <button 
          className={`${getStatusButtonColor(tracking.trackingStatus, themeColor)} text-white px-8 py-3 rounded-xl font-semibold shadow-lg transition-all hover:shadow-xl`}
        >
          <Truck className="w-5 h-5 inline-block mr-2" />
          Ver historial completo
        </button>
      </div>
    </motion.div>
  );
};

export default TrackingDetails; 