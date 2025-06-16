
import { supabase } from '@/integrations/supabase/client';

export interface SubscriptionData {
  plan: 'free' | 'basic' | 'premium' | 'enterprise' | 'enterprise-annual';
  status: 'active' | 'inactive' | 'cancelled';
  current_period_start?: string;
  current_period_end?: string;
  payment_provider?: string;
  amount?: number;
  currency?: string;
}

export const subscriptionService = {
  async getUserSubscription(userId: string): Promise<SubscriptionData | null> {
    try {
      console.log('🔍 Buscando assinatura para usuário:', userId);
      
      const { data: currentUser, error: userError } = await supabase.auth.getUser();
      
      if (userError || !currentUser.user) {
        console.error('❌ Erro de autenticação:', userError);
        return {
          plan: 'free',
          status: 'inactive'
        };
      }

      const isOwnUser = currentUser.user.id === userId;
      const isSuperAdmin = currentUser.user.email === 'yuriadrskt@gmail.com' || 
                          currentUser.user.email === 'adm.financeflow@gmail.com';

      console.log('🔍 Verificações:', { isOwnUser, isSuperAdmin, userEmail: currentUser.user.email });

      // Se for super admin, usar RPC segura
      if (isSuperAdmin) {
        try {
          console.log('🔑 Tentando buscar como super admin via RPC...');
          const { data: profileData, error: rpcError } = await (supabase as any).rpc('get_profile_for_admin', {
            target_user_id: userId
          });
          
          if (!rpcError && profileData && profileData.length > 0) {
            const userProfile = profileData[0];
            console.log('✅ Dados encontrados via RPC admin:', userProfile);
            const subscriptionData = userProfile.subscription_data as any;

            return {
              plan: userProfile.subscription || 'free',
              status: subscriptionData?.status || 'inactive',
              current_period_start: subscriptionData?.current_period_start,
              current_period_end: subscriptionData?.current_period_end,
              payment_provider: subscriptionData?.payment_provider,
              amount: subscriptionData?.amount,
              currency: subscriptionData?.currency || 'BRL'
            };
          } else {
            console.log('⚠️ RPC admin não retornou dados, tentando busca direta...');
          }
        } catch (rpcError) {
          console.error('❌ Erro na chamada RPC admin:', rpcError);
        }
      }

      // Fallback: tentar busca direta (para próprio usuário ou se RPC falhou)
      if (isOwnUser || isSuperAdmin) {
        try {
          console.log('🔍 Tentando busca direta...');
          const { data, error } = await supabase
            .from('profiles')
            .select('subscription, subscription_data')
            .eq('id', userId)
            .single();

          if (!error && data) {
            console.log('✅ Dados encontrados via consulta direta:', data);
            const subscriptionData = data.subscription_data as any;

            return {
              plan: data.subscription || 'free',
              status: subscriptionData?.status || 'inactive',
              current_period_start: subscriptionData?.current_period_start,
              current_period_end: subscriptionData?.current_period_end,
              payment_provider: subscriptionData?.payment_provider,
              amount: subscriptionData?.amount,
              currency: subscriptionData?.currency || 'BRL'
            };
          } else {
            console.error('❌ Erro na consulta direta:', error);
          }
        } catch (directError) {
          console.error('❌ Erro na consulta direta:', directError);
        }
      }

      // Se não é próprio usuário nem admin, retornar free
      if (!isOwnUser && !isSuperAdmin) {
        console.log('⚠️ Usuário não autorizado, retornando plano free');
        return {
          plan: 'free',
          status: 'inactive'
        };
      }

      // Retorno padrão se tudo falhar
      console.log('⚠️ Retornando plano free como fallback');
      return {
        plan: 'free',
        status: 'inactive'
      };

    } catch (error) {
      console.error('❌ Erro geral ao buscar assinatura:', error);
      return {
        plan: 'free',
        status: 'inactive'
      };
    }
  },

  async updateSubscription(userId: string, subscriptionData: Partial<SubscriptionData>): Promise<boolean> {
    try {
      console.log('🔄 Atualizando assinatura para usuário:', userId, subscriptionData);
      
      const { data: currentUser, error: userError } = await supabase.auth.getUser();
      
      if (userError || !currentUser.user) {
        console.error('❌ Erro de autenticação:', userError);
        return false;
      }

      const isOwnUser = currentUser.user.id === userId;
      const isSuperAdmin = currentUser.user.email === 'yuriadrskt@gmail.com' || 
                          currentUser.user.email === 'adm.financeflow@gmail.com';

      if (!isOwnUser && !isSuperAdmin) {
        console.error('❌ Não autorizado a atualizar esta assinatura');
        return false;
      }

      // Se for super admin, usar RPC segura
      if (isSuperAdmin) {
        try {
          console.log('🔑 Atualizando como super admin via RPC...');
          const updateData = {
            subscription: subscriptionData.plan,
            subscription_data: subscriptionData
          };

          const { error: rpcError } = await (supabase as any).rpc('admin_update_profile', {
            target_user_id: userId,
            update_data: updateData
          });

          if (!rpcError) {
            console.log('✅ Assinatura atualizada via RPC admin');
            return true;
          } else {
            console.error('❌ Erro na atualização via RPC admin:', rpcError);
          }
        } catch (rpcError) {
          console.error('❌ Erro na atualização via RPC admin:', rpcError);
        }
      }

      // Fallback: atualização direta (para próprio usuário ou se RPC falhou)
      if (isOwnUser || isSuperAdmin) {
        try {
          console.log('🔄 Tentando atualização direta...');
          const { error } = await supabase
            .from('profiles')
            .update({
              subscription: subscriptionData.plan,
              subscription_data: subscriptionData,
              updated_at: new Date().toISOString()
            })
            .eq('id', userId);

          if (!error) {
            console.log('✅ Assinatura atualizada via consulta direta');
            return true;
          } else {
            console.error('❌ Erro na atualização direta:', error);
          }
        } catch (directError) {
          console.error('❌ Erro na atualização direta:', directError);
        }
      }

      return false;
    } catch (error) {
      console.error('❌ Erro geral ao atualizar assinatura:', error);
      return false;
    }
  }
};
