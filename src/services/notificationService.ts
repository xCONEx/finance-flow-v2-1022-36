
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: {
    costId?: string;
    amount?: number;
    dueDate?: string;
    category?: string;
    type?: 'expense' | 'income';
  };
}

class NotificationService {
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Solicitar permissões
      const permission = await LocalNotifications.requestPermissions();
      
      if (permission.display === 'granted') {
        console.log('✅ Permissão de notificação concedida');
        
        // Configurar listeners se estiver em ambiente mobile
        if (Capacitor.isNativePlatform()) {
          await this.setupPushNotifications();
        }
        
        this.isInitialized = true;
      } else {
        console.log('❌ Permissão de notificação negada');
      }
    } catch (error) {
      console.error('❌ Erro ao inicializar notificações:', error);
    }
  }

  private async setupPushNotifications() {
    try {
      // Registrar para push notifications
      await PushNotifications.register();
      
      // Listener para quando o registro for bem-sucedido
      PushNotifications.addListener('registration', (token) => {
        console.log('✅ Push notification token:', token.value);
      });

      // Listener para erros de registro
      PushNotifications.addListener('registrationError', (error) => {
        console.error('❌ Erro no registro de push notifications:', error);
      });

      // Listener para notificações recebidas
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('📱 Notificação recebida:', notification);
      });

      // Listener para quando a notificação é tocada
      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('👆 Notificação tocada:', notification);
        // Aqui você pode navegar para a tela específica do custo
      });
    } catch (error) {
      console.error('❌ Erro ao configurar push notifications:', error);
    }
  }

  async scheduleLocalNotification(payload: NotificationPayload, scheduleDate?: Date) {
    try {
      await this.initialize();
      
      const notification = {
        title: `💰 ${payload.title}`,
        body: payload.body,
        id: Date.now(),
        schedule: scheduleDate ? { at: scheduleDate } : undefined,
        extra: payload.data || {},
        smallIcon: 'ic_notification',
        largeIcon: 'ic_notification_large',
        iconColor: '#6366f1',
        sound: 'notification.wav',
        attachments: undefined,
        actionTypeId: 'FINANCE_FLOW_ACTION',
        group: 'finance-flow',
        groupSummary: false,
      };

      await LocalNotifications.schedule({
        notifications: [notification]
      });
      
      console.log('✅ Notificação agendada:', notification);
      return notification.id;
    } catch (error) {
      console.error('❌ Erro ao agendar notificação:', error);
      throw error;
    }
  }

  async scheduleExpenseReminder(expense: any) {
    if (!expense.due_date || !expense.notification_enabled) {
      return;
    }

    const dueDate = new Date(expense.due_date);
    const now = new Date();
    
    // Determinar se é entrada ou saída
    const isIncome = expense.description?.includes('FINANCIAL_INCOME:') || expense.value < 0;
    const absoluteValue = Math.abs(expense.value);
    
    // Agendar notificação 1 dia antes
    const oneDayBefore = new Date(dueDate);
    oneDayBefore.setDate(dueDate.getDate() - 1);
    
    if (oneDayBefore > now) {
      if (isIncome) {
        await this.scheduleLocalNotification({
          title: 'Finance Flow - Cobrança em 1 dia',
          body: `Lembre-se de cobrar: ${expense.description.replace('FINANCIAL_INCOME: ', '').split(' | ')[0]} - R$ ${absoluteValue.toFixed(2)}`,
          data: {
            costId: expense.id,
            amount: absoluteValue,
            dueDate: expense.due_date,
            category: expense.category,
            type: 'income'
          }
        }, oneDayBefore);
      } else {
        await this.scheduleLocalNotification({
          title: 'Finance Flow - Vencimento em 1 dia',
          body: `${expense.description} vence amanhã - R$ ${absoluteValue.toFixed(2)}`,
          data: {
            costId: expense.id,
            amount: absoluteValue,
            dueDate: expense.due_date,
            category: expense.category,
            type: 'expense'
          }
        }, oneDayBefore);
      }
    }

    // Agendar notificação no dia do vencimento
    if (dueDate > now) {
      if (isIncome) {
        await this.scheduleLocalNotification({
          title: 'Finance Flow - Hora de cobrar!',
          body: `Vence hoje: ${expense.description.replace('FINANCIAL_INCOME: ', '').split(' | ')[0]} - R$ ${absoluteValue.toFixed(2)}`,
          data: {
            costId: expense.id,
            amount: absoluteValue,
            dueDate: expense.due_date,
            category: expense.category,
            type: 'income'
          }
        }, dueDate);
      } else {
        await this.scheduleLocalNotification({
          title: 'Finance Flow - Vencimento hoje!',
          body: `${expense.description} vence hoje - R$ ${absoluteValue.toFixed(2)}`,
          data: {
            costId: expense.id,
            amount: absoluteValue,
            dueDate: expense.due_date,
            category: expense.category,
            type: 'expense'
          }
        }, dueDate);
      }
    }
  }

  async cancelNotification(id: number) {
    try {
      await LocalNotifications.cancel({
        notifications: [{ id }]
      });
      console.log('✅ Notificação cancelada:', id);
    } catch (error) {
      console.error('❌ Erro ao cancelar notificação:', error);
    }
  }

  async cancelAllNotifications() {
    try {
      await LocalNotifications.cancel({
        notifications: []
      });
      console.log('✅ Todas as notificações canceladas');
    } catch (error) {
      console.error('❌ Erro ao cancelar todas as notificações:', error);
    }
  }

  // Método para notificações web (quando não está em ambiente mobile)
  async showWebNotification(payload: NotificationPayload) {
    if (!('Notification' in window)) {
      console.log('❌ Browser não suporta notificações');
      return;
    }

    if (Notification.permission === 'granted') {
      const notification = new Notification(`💰 ${payload.title}`, {
        body: payload.body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'finance-flow',
        data: payload.data
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        await this.showWebNotification(payload);
      }
    }
  }
}

export const notificationService = new NotificationService();
