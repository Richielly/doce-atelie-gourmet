# Elume Shop

Marca do aplicativo a partir de 2.4.3 (código Android 3403).
Assinatura: **Lojas, serviços e conexões.**

O símbolo mostra dois elos entrelaçados, roxo e coral sobre fundo claro.
Roxo: `#7137C6`; coral: `#F58573`; nome: `#3D1858`; fundo: `#FFF9F1`.
A composição segue a referência aprovada pelo proprietário: nome em minúsculas,
tipografia arredondada original em caminhos vetoriais e complemento SHOP.
Evite texto dentro do ícone: ele deve continuar legível em tamanhos pequenos.

- Vetor: `elume-icon.svg`.
- Imagem 512 × 512: `elume-icon.png`.
- Android: ícones adaptativo, monocromático, circular e legado.
- `elume-logo-horizontal.svg` e `.png`: entrada, ativação, configurações e Master.
- `elume-logo-vertical.svg` e `.png`: abertura nativa; Android 12+ controla o splash e usa o símbolo.
- `elume-identidade.png`: prancha de apresentação das versões (não é captura do aplicativo).
- Entrada multiestabelecimento: marca Elume Shop acima de Minha vitrine.
- Identidade de cada loja: permanece definida pelo lojista.

O pacote Android `com.doceatelie.gourmet`, a chave de assinatura, os esquemas
de QR antigos e as chaves de armazenamento permanecem iguais para permitir
atualização sem reinstalação e preservar vínculos, acesso e rascunhos.
Os nomes técnicos dos repositórios e scripts não são a marca exibida ao cliente.

Para regenerar os recursos, execute `python scripts/brand-assets.py` com Pillow.
O SVG, o VectorDrawable e os PNGs usam a mesma geometria nesse script.
Os nomes são desenhados em caminhos, sem depender de fontes instaladas no aparelho.
A disponibilidade jurídica da marca e dos domínios não foi verificada.

## Carregamento e ambientes — 2.4.4

A identidade de plataforma usa `platform-brand.css`. Entrada, ativação,
Master e configurações administrativas compartilham a marca; as cores e os
logotipos dos estabelecimentos continuam sendo definidos pelo lojista.

`loading-ui.js` apresenta apenas os elos pulsando e um arco circular, sem texto
visível. O caminho do símbolo é resolvido em relação ao script para funcionar
no APK, na web e em `/master`. Respeita redução de movimento e mantém a
indicação acessível de carregamento. Não altera envio manual nem regras de negócio.
