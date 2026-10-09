begin;

update public.produtos
set active = false
where id in (1, 7, 10, 11, 12, 13, 16, 17)
  and category not in ('vestidos', 'saias', 'blusas', 'conjuntos', 'acessorios', 'promocoes');

insert into public.configuracoes (key, value)
values ('banner_aviso', 'Virtuosa CG | Moda Evangélica | WhatsApp: (83) 98711-8599')
on conflict (key) do update set value = excluded.value;

commit;
