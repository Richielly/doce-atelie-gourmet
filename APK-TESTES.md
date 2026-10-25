# Doce Ateliê — APK Android de testes

Este repositório usa Capacitor 7 e GitHub Actions para gerar um APK de homologação sem precisar instalar Android Studio localmente.

## Como baixar
1. Acesse a aba **Actions** do repositório.
2. Abra o fluxo **APK Android de testes**.
3. Clique em **Run workflow** (ou aguarde a execução automática após uma alteração).
4. Quando o fluxo terminar com sucesso, abra a execução e baixe o artefato **doce-atelie-apk-teste**.
5. Extraia o ZIP e instale **app-debug.apk** no Android, autorizando a instalação de aplicativos desta origem, se necessário.

## Atenção
- Esta APK é **debug**, não assinada com uma chave de publicação própria. Não envie à Play Store.
- A demonstração armazena dados no armazenamento local do aplicativo; eles não sincronizam entre dispositivos.
- O app não possui autenticação real ou backend multiusuário. Não use dados reais de clientes nesta fase.
- A leitura de QR Code por câmera e notificações em segundo plano precisam de testes no dispositivo; o comportamento da WebView pode exigir ajustes nativos.
- O identificador Android atual é **com.doceatelie.gourmet**. Defina o identificador final antes de publicar na Play Store.
- O appId identifica o aplicativo, não a loja do cliente. A seleção de loja via QR Code ainda exige integração com backend e validação de segurança.
- O arquivo APK é disponibilizado como artefato do GitHub Actions por 30 dias.
