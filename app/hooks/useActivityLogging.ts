import { useCallback } from 'react';
import { ActivitiesService } from '@/app/services/activities.service';
import { useAuth } from '@/app/hooks/useAuth'; // Asegúrate de tener este hook
import { ActivityAction } from '@/types/activities';

export const useActivityLogging = () => {
  const { user } = useAuth(); // Asume que tienes un hook de autenticación

  const logActivity = useCallback(async ({
    action,
    description,
    entityType,
    entityId,
    metadata
  }: {
    action: ActivityAction;
    description: string;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, any>;
  }) => {
    if (!user) {
      console.warn('No se puede registrar actividad: Usuario no autenticado');
      return;
    }

    try {
      await ActivitiesService.logActivity({
        operatorId: user.id,
        operatorName: `${user.firstName} ${user.lastName}`,
        action,
        description,
        entityType,
        entityId,
        metadata
      });
    } catch (error) {
      console.error('Error al registrar actividad:', error);
    }
  }, [user]);

  return { logActivity };
}; 