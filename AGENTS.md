# Desenvolvimento do app

- Este repositório é o produto mobile, com cliente e administração. O servidor/API
  é outro produto e tem versão independente. Não vincule versões de APK às do backend.
- `release.json` define versionName e versionCode para build local e GitHub Actions.
  Aumente o code para cada atualização distribuída e preserve a chave permanente.
- Desenvolvimento web na porta 6002; outras portas expostas devem estar entre 6001 e 6010.
- O servidor local usa 6001. Em um celular, localhost aponta para o aparelho, não o PC.
- Não registre chaves, senhas, `.env`, builds ou ferramentas baixadas no Git.
- `npm run check` verifica sintaxe; `npm run android:prepare` prepara e sincroniza Android;
  `scripts/release.ps1` gera APK e pacote web. Android Studio é opcional.
- Melhorias da administração podem ser adotadas no servidor como artefato versionado.
  Não copie arquivos automaticamente para o servidor em cada build do app.
- O app abre na vitrine; QR identifica loja e servidor sem campos técnicos no cliente.
  Use assets.json como lista de arquivos ativos. Não reative o fluxo de catálogo
  separado ou publicação técnica de produtos na experiência de compra.
- A administração usa rascunhos no IndexedDB. Persistir no banco exige Enviar
  alterações, inclusive status de pedidos e propostas. Não reintroduza autoenvio.
- Dados e credenciais devem ser separados por loja e servidor, inclusive pedidos,
  perfil, carrinho, benefícios e rascunhos. Permita celular e computador simultâneos.
- Profissionais do salão são exceção ao envio manual por sincronização: apresentar
  resumo e confirmação por ação, depois enviar imediatamente. Sem envio de pendências
  ao abrir/reconectar; tentar novamente exige revisão e nova confirmação.
  O fluxo do dono/lojista permanece com rascunho e Enviar alterações.
- Nas telas do salão, ações usam ícones com title/aria-label; escolhas de valor,
  como vagas por horário, mantêm seu conteúdo. Identifique sempre papel e loja.
- Painéis exibem só a parcela financeira do papel autenticado. Preço pode vir do
  salão ou do profissional autorizado, sem expor acordos/repasse ao cliente.
- Preço definido pelo profissional: o dono configura o percentual do salão e o
  restante pertence ao profissional. O painel profissional mostra só operação e
  repasses próprios, sem faturamento do salão ou dados de colegas.

- Usabilidade prevalece sobre ícones isolados: ações em cards, formulários e confirmações mantêm texto visível com ícone de apoio; navegação tem rótulo. Favoritos usa coração, Benefícios usa presente.

- Online/offline profissional é escolha operacional para novas reservas. Ausências/revogação sinalizam compromissos para recuperação pelo dono; remanejamento exige aceite do cliente. Não cancelar nem transferir silenciosamente. Capacidade histórica sem registro deve aparecer desconhecida.

- Exceção visual da ficha técnica: somente dois ícones no cabeçalho, salvar e sair, sem texto visível e com title/aria-label. Não duplicar saída no rodapé. Salvar mantém o editor aberto; saída com alterações não salvas oferece salvar/descartar/continuar.

- Ativação administrativa: o mesmo código pode autorizar celular e computador opcional, com chaves independentes. Não revogar o primeiro ao ativar o segundo. Repetições idempotentes não consomem outra autorização. Convites profissionais continuam separados.

- Central de notificações: somente cinco prévias recentes; contador representa todas as não lidas. Tocar abre o detalhe completo e lê só aquele aviso; Ver navega apenas quando existir ação válida, preservando loja e papel. Não apagar histórico para limitar a interface.
