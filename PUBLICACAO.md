# Virtuosa CG

Catálogo estático da Virtuosa CG, com produtos e administração no Supabase.

## GitHub Pages

O workflow `.github/workflows/pages.yml` publica os arquivos da loja ao atualizar a branch `main`. Os backups locais, testes e arquivos de configuração do banco não entram na publicação.

Repositório: `asasdesignerbrasil-hue/virtuosa-cg`.

Em Settings > Pages, selecione GitHub Actions como origem e configure o domínio `virtuosacg.store`. O arquivo CNAME sozinho não configura o domínio quando a publicação usa Actions.

## DNS na Hostinger

Troque os registros A de estacionamento do host `@` por estes quatro registros A:

| Tipo | Nome | Valor |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | asasdesignerbrasil-hue.github.io |

Mantenha os registros MX e TXT de e-mail. Se existirem registros AAAA de estacionamento no host `@`, remova-os ou substitua-os pelos valores de GitHub Pages indicados na documentação oficial. Depois da validação do domínio e da emissão do certificado, ative Enforce HTTPS no GitHub Pages.

Fonte: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site

## Painel

Acesso: `https://virtuosacg.store/admin/`. A senha da conta administrativa existente foi preservada. O botão de recuperação envia um link para cadastrar uma nova senha.

O Supabase usa `https://virtuosacg.store` como Site URL, permite os retornos do painel e tem cadastro público de usuários desativado. O frontend contém somente a chave pública de acesso ao projeto. Tokens administrativos devem ficar fora do repositório.

O catálogo anterior foi desativado, sem excluir produtos ou pedidos. Cadastre as peças da Virtuosa CG no painel, usando as categorias de moda.

WhatsApp da loja: `(83) 98711-8599`.

## Verificação local

```powershell
node --test tests/admin-auth.test.cjs
python -m http.server 8000 --bind 127.0.0.1
```

Loja: `http://127.0.0.1:8000/`. Painel: `http://127.0.0.1:8000/admin/`.
