#!/bin/sh
# Copia una fuente de solo lectura al volumen de trabajo del entorno de build.
# Uso: sincronizar vigia | sincronizar banco
set -eu
origen="/fuente/$1/"
destino="/work/$1/"
[ -d "$origen" ] || { echo "No existe $origen" >&2; exit 1; }
mkdir -p "$destino"
# Lo que ignora git (dependencias y salidas de build) ni se copia ni se borra en el destino.
rsync -a --delete --exclude .git --filter=':- .gitignore' "$origen" "$destino"
