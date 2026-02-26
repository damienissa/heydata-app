-- When a message is inserted into chat_messages, touch the parent session's updated_at
-- so that sidebar ordering (ORDER BY updated_at DESC) reflects last activity.

create or replace function public.touch_session_updated_at()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.chat_sessions
    set updated_at = now()
  where id = NEW.session_id;
  return NEW;
end;
$$;

create trigger trg_touch_session_on_message
  after insert on public.chat_messages
  for each row
  execute function public.touch_session_updated_at();
