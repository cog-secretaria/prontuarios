# Arquivo de Prontuários

App interno da secretaria. Uso restrito aos funcionários autorizados.

Este repositório tem só o código do app. Os dados ficam num banco protegido por login e não passam por aqui. O manual de uso fica com a secretaria.

## Manutenção

- Ao mudar o `index.html`, troque o `VERSAO` no `index.html` e o `CACHE` no `sw.js`: os aparelhos se atualizam sozinhos.
- Ao mudar o que cada nível pode fazer no `firestore.rules`, troque também o bloco `versao` (ex.: `regras-6`) e o `REGRAS` no `index.html`. Assim, se as regras novas não forem coladas no Firebase, o app avisa a secretaria.
- Não escreva e-mails, nomes de pessoas nem dados de alunos em nenhum arquivo daqui: tudo o que está neste repositório fica público.
