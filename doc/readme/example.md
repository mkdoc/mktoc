## Example

Create a standalone table of contents:

```shell
mkcat README.md | mktoc -s | mkout > TOC.md
```

Inject the table of contents into a document containing the `<!-- @toc -->` marker:

```shell
mkcat readme.md | mktoc | mkout > README.md
```

Set an initial heading with the specified level:

```shell
mkcat readme.md | mktoc --title 'Table of Contents' --level 2 | mkout > README.md
```
