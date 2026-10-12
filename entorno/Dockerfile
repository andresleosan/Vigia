# Entorno de build de Vigía (ENV-01): sin privilegios, sin credenciales y sin acceso al host.
# Las versiones llegan como argumentos y quedan anotadas en docs/pico/informe.md.
ARG BASE
FROM ${BASE}
ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
 && apt-get install -y --no-install-recommends openjdk-17-jdk-headless git curl unzip rsync ca-certificates python3 xz-utils ffmpeg \
 && rm -rf /var/lib/apt/lists/*
ARG NODE_VERSION
ARG NODE_SHA256
RUN curl -fsSLo /tmp/node.tar.xz "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" \
 && echo "${NODE_SHA256}  /tmp/node.tar.xz" | sha256sum -c - \
 && tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 --no-same-owner \
 && rm /tmp/node.tar.xz
ENV ANDROID_HOME=/opt/android-sdk
ARG CMDLINE_TOOLS_ZIP
ARG CMDLINE_TOOLS_SHA256
RUN curl -fsSLo /tmp/clt.zip "https://dl.google.com/android/repository/${CMDLINE_TOOLS_ZIP}" \
 && echo "${CMDLINE_TOOLS_SHA256}  /tmp/clt.zip" | sha256sum -c - \
 && mkdir -p "$ANDROID_HOME/cmdline-tools" \
 && unzip -q /tmp/clt.zip -d "$ANDROID_HOME/cmdline-tools" \
 && mv "$ANDROID_HOME/cmdline-tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest" \
 && rm /tmp/clt.zip
COPY sincronizar.sh /usr/local/bin/sincronizar
RUN chmod 755 /usr/local/bin/sincronizar \
 && useradd -m -u 1001 -s /bin/bash vigia \
 && mkdir -p /work && chown vigia:vigia /work \
 && chown -R vigia:vigia "$ANDROID_HOME"
USER vigia
# Las fuentes son de otro usuario y se leen en solo lectura.
RUN git config --global --add safe.directory /fuente/vigia \
 && git config --global --add safe.directory /fuente/vigia/.git \
 && git config --global --add safe.directory /fuente/banco \
 && git config --global --add safe.directory /fuente/banco/.git
ENV PATH="/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools:${PATH}" \
    WRANGLER_SEND_METRICS=false \
    NEXT_TELEMETRY_DISABLED=1 \
    EXPO_NO_TELEMETRY=1
# Instalar el SDK implica aceptar sus licencias (autorizado en la decisión 3 de F1).
RUN yes | sdkmanager --licenses > /dev/null && sdkmanager --install "platform-tools"
WORKDIR /work
