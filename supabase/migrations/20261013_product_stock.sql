begin;

alter table public.produtos add column if not exists stock integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.produtos'::regclass and conname = 'produtos_stock_nonnegative'
  ) then
    alter table public.produtos
      add constraint produtos_stock_nonnegative check (stock is null or stock >= 0);
  end if;
end;
$$;

commit;
