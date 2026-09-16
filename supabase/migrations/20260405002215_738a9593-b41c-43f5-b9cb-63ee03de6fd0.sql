CREATE POLICY "Recipients can view messages sent to them"
ON public.messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.message_recipients mr
    WHERE mr.message_id = messages.id
    AND mr.recipient_id = auth.uid()
  )
);