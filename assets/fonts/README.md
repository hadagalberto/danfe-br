# Fonte embutida — DANFE Sans

O renderizador de DANFE embute uma fonte vetorial para produzir saída
determinística em Node e no navegador, sem depender de fontes instaladas no
sistema operacional (MOC 7.0 — Anexo II §3.7 exige tamanhos mínimos em pontos;
a especificação do projeto pede uma fonte OFL).

## Origem

- Família original: **Liberation Sans 2.1.5**, Copyright (c) 2012 Red Hat,
  Inc., com Reserved Font Name "Liberation".
- Licença: **SIL Open Font License, Version 1.1** — texto integral em
  `OFL.txt`.
- Download: https://github.com/liberationfonts/liberation-fonts/releases/tag/2.1.5
  (arquivo `liberation-fonts-ttf-2.1.5.tar.gz`, publicado em 30/09/2021).

## Modificações e renome (exigência da OFL §3.3)

Os arquivos `DANFESans-Regular.ttf` e `DANFESans-Bold.ttf` são **subconjuntos**
da fonte original, contendo apenas os glifos necessários ao DANFE
(U+0020–U+024F, U+2000–U+206F, euro e ™). Por serem versões modificadas, o
nome reservado "Liberation" **não** foi mantido: a família foi renomeada para
**DANFE Sans** nos registros `name` 1, 3, 4 e 6. O texto da OFL é preservado
sem alterações em `OFL.txt`.

Os mesmos bytes, codificados em Base64, estão em `src/render/font-data.ts`
(arquivo gerado) para que a biblioteca funcione também no navegador, onde não
há acesso a `fs`.

## Regeneração

1. Baixe o tarball da release acima e extraia `LiberationSans-Regular.ttf` e
   `LiberationSans-Bold.ttf`.
2. Subconjunte com `fonttools`
   (`pyftsubset --unicodes=U+0020-024F,U+2000-206F,U+20AC,U+2122`) e renomeie
   os registros `name` conforme indicado.
3. Codifique os TTFs em Base64 em `src/render/font-data.ts`.
