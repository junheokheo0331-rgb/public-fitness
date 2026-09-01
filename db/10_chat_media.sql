-- GymLink 대화 사진: 비공개 Storage + 실시간 메시지
-- 01~09 적용 후 실행한다. 사진 원본은 공개 URL로 노출하지 않는다.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-images',
  'chat-images',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists chat_images_read on storage.objects;
create policy chat_images_read on storage.objects for select to authenticated
using (
  bucket_id = 'chat-images'
  and exists (
    select 1 from public.threads th
    where th.id::text = (storage.foldername(name))[1]
      and (th.member_id = auth.uid() or th.trainer_id = auth.uid() or public.is_admin())
  )
);

drop policy if exists chat_images_insert on storage.objects;
create policy chat_images_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'chat-images'
  and (storage.foldername(name))[2] = auth.uid()::text
  and exists (
    select 1 from public.threads th
    where th.id::text = (storage.foldername(name))[1]
      and (th.member_id = auth.uid() or th.trainer_id = auth.uid())
  )
);

-- 메시지가 저장되지 못한 경우 클라이언트가 방금 올린 파일을 회수할 수 있다.
drop policy if exists chat_images_delete_own on storage.objects;
create policy chat_images_delete_own on storage.objects for delete to authenticated
using (
  bucket_id = 'chat-images'
  and (storage.foldername(name))[2] = auth.uid()::text
);

-- Postgres Changes 기반 대화 갱신. 이미 등록된 프로젝트에서도 재실행 가능하다.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
