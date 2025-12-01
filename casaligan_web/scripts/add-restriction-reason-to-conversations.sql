-- Add restriction_reason field to conversations table
-- This allows storing the reason when a conversation is restricted

ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS restriction_reason text;

-- Create index for faster queries on restricted conversations
CREATE INDEX IF NOT EXISTS idx_conversations_restriction_reason ON public.conversations(restriction_reason) WHERE restriction_reason IS NOT NULL;

