create or replace function public.record_world_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_day integer;
  label text;
  detail text;
  memory jsonb;
begin
  select greatest(1, coalesce((w.world_memory->>'day')::integer,1)), coalesce(w.world_memory,'{}'::jsonb)
    into current_day, memory
  from public.worlds w where w.id=NEW.world_id;
  if current_day is null then return NEW; end if;

  label := case tg_table_name
    when 'regions' then 'Région'
    when 'civilizations' then case when coalesce(NEW.culture,'')='Village' then 'Village' else 'Civilisation' end
    when 'characters' then 'Personnage'
    when 'creatures' then 'Créature'
    else tg_table_name
  end;
  detail := label || ' « ' || coalesce(NEW.name,'sans nom') || ' » rejoint le monde.';

  insert into public.timeline_events(world_id,title,description,world_day,consequences)
  values (
    NEW.world_id,
    label || ' créée — ' || coalesce(NEW.name,'Sans nom'),
    detail,
    current_day,
    jsonb_build_array('Le monde intègre une nouvelle entité.', 'La carte et la chronologie peuvent évoluer à partir de cette création.')
  );

  if tg_table_name='regions' then
    memory := jsonb_set(memory, '{map_version}', to_jsonb(coalesce((memory->>'map_version')::integer,0)+1), true);
  end if;
  update public.worlds set world_memory=memory, updated_at=now() where id=NEW.world_id;
  return NEW;
end;
$function$;

drop trigger if exists regions_world_change on public.regions;
create trigger regions_world_change after insert on public.regions for each row execute function public.record_world_change();
drop trigger if exists civilizations_world_change on public.civilizations;
create trigger civilizations_world_change after insert on public.civilizations for each row execute function public.record_world_change();
drop trigger if exists characters_world_change on public.characters;
create trigger characters_world_change after insert on public.characters for each row execute function public.record_world_change();
drop trigger if exists creatures_world_change on public.creatures;
create trigger creatures_world_change after insert on public.creatures for each row execute function public.record_world_change();

revoke all on function public.record_world_change() from public, anon, authenticated;
