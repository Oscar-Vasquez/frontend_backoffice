import React from 'react';
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { customToast } from '../components/ui/custom-toast';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
// Variable para deshabilitar las notificaciones en tiempo real
const DISABLE_NOTIFICATIONS = process.env.NEXT_PUBLIC_DISABLE_NOTIFICATIONS === 'true';

export function useNotifications(enableNotifications = !DISABLE_NOTIFICATIONS) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    // Si las notificaciones están deshabilitadas, no intentar conectar
    if (!enableNotifications) {
      console.log('🔄 Notificaciones en tiempo real deshabilitadas por configuración');
      return;
    }
    
    const connectSocket = () => {
      try {
        console.log('🔄 Intentando conectar a:', `${SOCKET_URL}/notifications`);
        
        // Inicializar la conexión Socket.IO con configuración adicional
        socketRef.current = io(`${SOCKET_URL}/notifications`, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: maxReconnectAttempts,
          reconnectionDelay: 1000,
          timeout: 10000,
          forceNew: true,
          path: '/socket.io'
        });

        // Manejar la conexión
        socketRef.current.on('connect', () => {
          console.log('🔌 Conectado al servidor de notificaciones');
          console.log('🆔 Socket ID:', socketRef.current?.id);
          setIsConnected(true);
          reconnectAttempts.current = 0;
          
          customToast.success({
            title: "Conectado",
            description: "Sistema de notificaciones activado",
          });
        });

        // Manejar la desconexión
        socketRef.current.on('disconnect', (reason) => {
          console.log('🔌 Desconectado del servidor de notificaciones. Razón:', reason);
          setIsConnected(false);
          
          if (reason !== 'io client disconnect') {
            customToast.error({
              title: "Desconectado",
              description: "Se perdió la conexión con el servidor de notificaciones",
            });
          }
        });

        // Manejar errores de conexión
        socketRef.current.on('connect_error', (error) => {
          console.error('❌ Error de conexión:', error.message);
          reconnectAttempts.current++;
          
          if (reconnectAttempts.current >= maxReconnectAttempts) {
            socketRef.current?.close();
            console.log('❌ Se alcanzó el máximo número de intentos de reconexión');
            // Evitamos mostrar el toast de error para no molestar al usuario
            // customToast.error({
            //   title: "Error de Conexión",
            //   description: "No se pudo conectar al servidor de notificaciones",
            // });
          }
        });

        // Confirmación de conexión desde el servidor
        socketRef.current.on('connected', (data) => {
          console.log('✅ Conexión confirmada por el servidor:', data);
        });

        // Escuchar eventos de nueva factura
        socketRef.current.on('newInvoice', (data) => {
          console.log('📝 Nueva factura recibida:', data);
          
          // Mostrar notificación
          customToast.success({
            title: "Nueva Factura Generada",
            description: `Se ha generado una nueva factura por $${data.data.totalAmount.toFixed(2)}`,
            action: (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-500">
                  {new Date(data.timestamp).toLocaleTimeString()}
                </span>
                <span className="text-xs text-gray-500">
                  Cliente: {data.data.customerId}
                </span>
              </div>
            ),
          });
        });

        // Debug: Escuchar todos los eventos
        socketRef.current.onAny((eventName, ...args) => {
          console.log('🎯 Evento recibido:', eventName, args);
        });

      } catch (error) {
        console.error('❌ Error al inicializar Socket.IO:', error);
      }
    };

    connectSocket();

    // Limpiar al desmontar
    return () => {
      if (socketRef.current) {
        console.log('🔌 Desconectando socket...');
        socketRef.current.disconnect();
      }
    };
  }, [enableNotifications]); // Añadimos enableNotifications como dependencia

  return {
    socket: socketRef.current,
    isConnected,
    disabled: !enableNotifications
  } as const;
} 