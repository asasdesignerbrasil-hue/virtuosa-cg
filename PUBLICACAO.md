# Virtuosa CG

Catálogo estático da Virtuosa CG, com produtos e administração no Supabase.

## GitHub e Vercel

Repositório: https://github.com/asasdesignerbrasil-hue/virtuosa-cg

O GitHub armazena o código e executa os testes. A Vercel hospeda a loja, conectada à branch `main` do repositório. O workflow de publicação no GitHub Pages foi substituído por uma verificação de testes e build.

1. Na Vercel, abra Add New > Project e importe `asasdesignerbrasil-hue/virtuosa-cg`.
2. Use Framework Preset: Other e Root Directory: a raiz do repositório.
3. O arquivo `vercel.json` define Build Command: `npm run build` e Output Directory: `dist`.
4. Faça o primeiro deploy. Depois de conectar o repositório, os próximos pushes em `main` gerarão publicações na Vercel.
5. Em Settings > Domains, adicione `virtuosacg.store`. Adicione também `www.virtuosacg.store`, com redirecionamento para o domínio principal.

O build usa apenas Node.js e copia os arquivos públicos para `dist`. Backups, testes, documentos e arquivos de configuração do banco ficam fora da hospedagem. A rota `/admin/` mantém os parâmetros de recuperação de senha.

Não é necessário cadastrar um token administrativo do Supabase na Vercel. O site já usa a chave pública do projeto.

## DNS na Hostinger

Depois de adicionar os domínios na Vercel, copie exatamente os registros que aparecerem em Settings > Domains:

| Tipo | Nome | Valor |
| --- | --- | --- |
| A | @ | Endereço IP indicado pela Vercel para este projeto |
| CNAME | www | Destino indicado pela Vercel para este projeto |

Substitua os registros de estacionamento ou de GitHub Pages que apontem esses mesmos hosts para outro servidor. Confira também se existem registros AAAA conflitantes. Mantenha os registros MX e TXT de e-mail.

Verifique o domínio e o certificado HTTPS no painel da Vercel. Se a loja anterior ainda estiver ativa no GitHub Pages, desative essa hospedagem após confirmar que a Vercel está funcionando.

Fonte: https://vercel.com/docs/domains/working-with-domains/add-a-domain

## Painel

Acesso: `https://virtuosacg.store/admin/`. A senha da conta administrativa existente foi preservada. O botão de recuperação envia um link para cadastrar uma nova senha.

O Supabase usa `https://virtuosacg.store` como Site URL, permite os retornos do painel e tem cadastro público de usuários desativado. O frontend contém somente a chave pública de acesso ao projeto. Tokens administrativos devem ficar fora do repositório.

Para recuperar a senha também na URL `vercel.app` do projeto, adicione essa URL exata, terminada em `/dashboard/admin.html?recovery=1`, às Redirect URLs do Supabase Auth. O domínio de produção já está configurado. O login por e-mail e senha usa a mesma conta administrativa.

O catálogo anterior foi desativado, sem excluir produtos ou pedidos. Cadastre as peças da Virtuosa CG no painel, usando as categorias de moda.

WhatsApp da loja: `(83) 98711-8599`.

## Verificação local

```powershell
npm.cmd test
npm.cmd run build
python -m http.server 8000 --bind 127.0.0.1
```

Loja: `http://127.0.0.1:8000/`. Painel: `http://127.0.0.1:8000/admin/`.
