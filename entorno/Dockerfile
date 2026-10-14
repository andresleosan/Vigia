# Entorno de build de Vigía (ENV-01): sin privilegios, sin credenciales y sin acceso al host.
# Las versiones llegan como argumentos y quedan anotadas en docs/pico/informe.md.
ARG BASE
FROM ${BASE}
ARG DEBIAN_FRONTEND=noninteractive
# Los paquetes salen de una instantánea fechada del archivo de Ubuntu: mismas versiones en cada build.
# Para llegar a ella por HTTPS hacen falta antes los certificados: salen del archivo vivo, con versión
# exacta (si el archivo ya no la tiene, el build falla en vez de cambiar), y apt los verifica con su firma.
ARG APT_ARRANQUE
ARG APT_SNAPSHOT
RUN apt-get update \
 && apt-get install -y --no-install-recommends $APT_ARRANQUE \
 && rm -rf /var/lib/apt/lists/* \
 && apt-get update --snapshot "$APT_SNAPSHOT" \
 && apt-get install -y --no-install-recommends --snapshot "$APT_SNAPSHOT" \
      openjdk-17-jdk-headless git curl unzip rsync python3 xz-utils ffmpeg \
 && rm -rf /var/lib/apt/lists/*
ARG NODE_VERSION
ARG NODE_SHA256
RUN curl -fsSLo /tmp/node.tar.xz "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" \
 && echo "${NODE_SHA256}  /tmp/node.tar.xz" | sha256sum -c - \
 && tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 --no-same-owner \
 && rm /tmp/node.tar.xz
ARG PNPM_VERSION
ARG PNPM_SHA256
RUN curl -fsSLo /tmp/pnpm.tgz "https://registry.npmjs.org/pnpm/-/pnpm-${PNPM_VERSION}.tgz" \
 && echo "${PNPM_SHA256}  /tmp/pnpm.tgz" | sha256sum -c - \
 && npm install -g --ignore-scripts /tmp/pnpm.tgz \
 && rm /tmp/pnpm.tgz
ENV ANDROID_HOME=/opt/android-sdk
ARG CMDLINE_TOOLS_ZIP
ARG CMDLINE_TOOLS_SHA256
ARG PLATFORM_TOOLS_ZIP
ARG PLATFORM_TOOLS_SHA256
RUN curl -fsSLo /tmp/clt.zip "https://dl.google.com/android/repository/${CMDLINE_TOOLS_ZIP}" \
 && echo "${CMDLINE_TOOLS_SHA256}  /tmp/clt.zip" | sha256sum -c - \
 && mkdir -p "$ANDROID_HOME/cmdline-tools" \
 && unzip -q /tmp/clt.zip -d "$ANDROID_HOME/cmdline-tools" \
 && mv "$ANDROID_HOME/cmdline-tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest" \
 && curl -fsSLo /tmp/pt.zip "https://dl.google.com/android/repository/${PLATFORM_TOOLS_ZIP}" \
 && echo "${PLATFORM_TOOLS_SHA256}  /tmp/pt.zip" | sha256sum -c - \
 && unzip -q /tmp/pt.zip -d "$ANDROID_HOME" \
 && rm /tmp/clt.zip /tmp/pt.zip
ENV PATH="/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools:${PATH}" \
    WRANGLER_SEND_METRICS=false \
    NEXT_TELEMETRY_DISABLED=1 \
    EXPO_NO_TELEMETRY=1
# Instalar el SDK implica aceptar sus licencias (autorizado en la decisión 3 de F1).
# Lo instala root con versión exacta (sdkmanager comprueba cada paquete contra el manifiesto de Google)
# y queda de solo lectura: ni Gradle ni el código de terceros pueden bajar ni cambiar herramientas.
ARG SDK_PAQUETES
RUN yes | sdkmanager --licenses > /dev/null \
 && sdkmanager --install $SDK_PAQUETES > /dev/null \
 && chmod -R a-w "$ANDROID_HOME"
COPY sincronizar.sh /usr/local/bin/sincronizar
RUN chmod 755 /usr/local/bin/sincronizar \
 && useradd -m -u 1001 -s /bin/bash vigia \
 && mkdir -p /work && chown vigia:vigia /work
USER vigia
# El banco se lee en solo lectura y es de otro usuario. El .git del repo no se monta (ver archivo privado).
RUN git config --global --add safe.directory /fuente/banco \
 && git config --global --add safe.directory /fuente/banco/.git
WORKDIR /work
# H0b: iproute2 trae tc (netem de P7, en un contenedor auxiliar con NET_ADMIN) y ss (comprobación de OPS-03).
# Sale de la misma instantánea y va en una capa al final: las de arriba siguen siendo las de H0a.
USER root
RUN apt-get update --snapshot "$APT_SNAPSHOT" \
 && apt-get install -y --no-install-recommends --snapshot "$APT_SNAPSHOT" iproute2 \
 && rm -rf /var/lib/apt/lists/*
USER vigia
