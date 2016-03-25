# Contents Index

<? @include readme/badges.md ?>

> Generate a table of contents index

<? @include {=readme} install.md ?>

## Usage

Create the stream and write a [commonmark][] document:

<? @source {javascript=s/\.\.\/index/mktoc/gm} usage.js ?>

<!-- @toc -->

<? @include {=readme} help.md ?>

<? @exec mkapi index.js --title=API --level=2 ?>
<? @include {=readme} license.md links.md ?>
