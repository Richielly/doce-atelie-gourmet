# Aplicativo multi-loja

O aplicativo abre na vitrine. O cliente lê o QR do lojista e acessa os produtos, a identidade,
os pedidos e os benefícios daquela loja. Não há configuração de API nem publicação de
produtos na experiência do cliente. Cada loja mantém seu estado e identificação separados.

## Desenvolvimento

```powershell
npm install
npm run dev
npm run check
npm test
```

Abra http://localhost:6002. O servidor usa 6001; somente portas entre 6001 e 6010 podem ser
expostas no computador. No celular, use o endereço HTTPS público contido no QR da loja.

`assets.json` define os arquivos ativos empacotados. `app-entry.js` seleciona vitrine,
cliente ou administração. `customer-runtime.js` integra a interface existente ao servidor;
`admin-runtime.js` mantém rascunhos no IndexedDB e publica somente por Enviar alterações.
Os antigos `admin-sync.js`, `publish-page.js` e `product-publish.js` foram removidos; o
build ainda os apaga de `dist/` gerados antes. O cliente nunca usa dados do workspace administrativo.

## Administração

Entre pela Área do lojista e autorize cada aparelho com um código gerado no Master.
Celular e computador podem administrar a mesma loja. Salvar um formulário prepara o
rascunho; Enviar alterações publica o conjunto. Conflitos de revisão preservam o rascunho.
Importações do app antigo ficam na entrada administrativa e também exigem envio manual.

## Android e versões

`release.json` define versionName e versionCode, independentemente da versão do servidor.
O code de uma versão distribuída deve crescer e a assinatura deve manter a chave permanente.

```powershell
npm run android:prepare
powershell -ExecutionPolicy Bypass -File scripts/release.ps1 -Mode Debug
```

Use `-Mode Release -KeyStore CAMINHO.p12 -PasswordFile SENHA.txt` para Release assinada,
com alias `doce-atelie`. `-NextVersion` incrementa automaticamente; o atalho GERAR-APK.bat
do workspace já usa essa opção. Saídas: `releases/VERSAO/Debug` ou `Release`, APK, metadados,
checksums e pacote web. As chaves, senhas e ferramentas não devem entrar no Git.

O script respeita JAVA_HOME e ANDROID_HOME e encontra as ferramentas portáteis em
`../.tools/` nesta máquina. Android Studio é opcional para compilar pela linha de comando.
O QR é gerado no painel e lido no app sem carregar bibliotecas externas durante o uso.
Para publicar a interface no servidor, adote explicitamente o pacote web; não faça cópia
automática em cada build do aplicativo. Leia DESENVOLVIMENTO.md do workspace do servidor.

## GitHub

O workflow usa npm ci, verificações, release.json e os mesmos scripts Android locais.
Revise alterações com git diff e só registre/envie arquivos de código, nunca credenciais,
dados, ferramentas ou builds.
