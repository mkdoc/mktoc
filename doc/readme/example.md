## Example

Create a standalone table of contents:

```shell
mkcat README.md | mktoc -s | mkout > TOC.md
```

Inject the table of contents into a document containing the `<!-- @toc -->` marker:

```shell
mkcat readme.md | mktoc | mkout > README.md
```
