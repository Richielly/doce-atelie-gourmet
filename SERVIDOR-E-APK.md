# Painel conectado e APK atualizável

Abra Administração → Entrar no painel completo após ativar o aplicativo.
O primeiro acesso pode importar dados deste aparelho ou um backup JSON do app antigo.
Se já houver painel no servidor, ele será carregado. O servidor rejeita revisões antigas,
e o app mostra alterações pendentes até receber confirmação.

Todos os módulos administrativos são gravados no PostgreSQL pelo endpoint autenticado
/admin/shops/{id}/workspace. Os produtos são publicados no catálogo da API.
Os pedidos online aparecem em seção própria da central de pedidos.
As telas públicas antigas de fidelidade/orçamentos ainda não têm endpoints próprios;
persistir o painel administrativo não sincroniza essas telas de cliente.

## Atualizações Android

applicationId: com.doceatelie.gourmet (mantido).
versionName: 1.1.<número da execução>. versionCode: 1000 + número da execução.
Reexecutar o mesmo run mantém a versão; para incrementá-la, inicie uma nova execução.
A assinatura usa sempre o PKCS12 do Secret ANDROID_KEYSTORE_BASE64, senha no Secret
ANDROID_KEYSTORE_PASSWORD e alias doce-atelie. Não substitua a chave entre versões.

Sem os Secrets, o artefato é NÃO ASSINADO e precisa de assinatura local com essa mesma
chave antes da instalação. A chave nunca é incluída no código ou nos artefatos públicos.
Guarde o arquivo da chave e a senha em backup seguro.

Os APKs debug anteriores usavam chaves descartáveis geradas por runners. Sem aquela
chave não é possível atualizá-los por cima. Exporte backup antes de trocar a instalação.
Após a primeira instalação com a assinatura fixa, os próximos APKs assinados com ela
e versionCode maior atualizam o aplicativo e preservam seus dados.

Validações automatizadas do servidor e do cliente são mantidas no workspace do servidor.
Ainda é necessário teste de atualização e uso em aparelho Android.
