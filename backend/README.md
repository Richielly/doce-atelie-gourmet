# Backend multi-loja — ambiente de testes

Esta pasta contém uma API FastAPI e PostgreSQL 17 para **teste local**. O GitHub Pages não executa backend ou banco de dados.

## Executar

1. Copie `.env.example` para `.env`.
2. Configure `POSTGRES_PASSWORD`, `BOOTSTRAP_TOKEN` e `CORS_ORIGINS` com valores próprios. Nunca envie o arquivo `.env` ao GitHub.
3. Execute `docker compose --env-file .env up -d --build` dentro desta pasta.
4. Verifique `http://localhost:7426/health` e `http://localhost:7426/docs`.

A API contém cadastro de lojas e produtos, catálogo público isolado por loja, geração de código de ativação de uso único, registro de chave pública Ed25519 de um único dispositivo por loja, e autenticação de alterações via desafio assinado. **O aplicativo web/APK ainda não está conectado a esta API.** É necessário implementar a integração no Capacitor e armazenar a chave privada no Android Keystore antes do teste entre celulares.

## Segurança

- Os endpoints de provisionamento usam `X-Bootstrap-Token` e devem ser restritos ao operador, não à APK.
- Use HTTPS antes de expor o servidor à internet. Não publique a porta PostgreSQL.
- A ativação substitui o dispositivo anterior. Um novo código só pode ser emitido pelo operador autenticado.
- Este backend é uma base de homologação, não um sistema de produção: faltam migrações Alembic, backup, rate limiting, autenticação do operador mais completa, pedidos, fidelidade e isolamento de todas as entidades de negócio.
- Para ver o catálogo no navegador: `GET /shops/{shop_id}/catalog`. O QR Code deve carregar um identificador público de loja, não uma credencial administrativa.
