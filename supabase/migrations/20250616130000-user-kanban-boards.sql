
-- Criar tabela específica para kanban dos usuários
CREATE TABLE public.user_kanban_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  board_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Habilitar RLS
ALTER TABLE public.user_kanban_boards ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para user_kanban_boards
CREATE POLICY "Users can manage their own kanban board" ON public.user_kanban_boards
  FOR ALL USING (auth.uid() = user_id);

-- Criar índice para performance
CREATE INDEX idx_user_kanban_boards_user_id ON public.user_kanban_boards(user_id);
