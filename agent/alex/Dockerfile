FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    xvfb x11vnc novnc websockify \
    openbox tint2 pcmanfm feh \
    xterm \
    chromium \
    xdotool \
    imagemagick \
    wget curl \
    fonts-liberation fonts-inter \
    dmz-cursor-theme \
    libx11-6 libxext6 libxrender1 libxtst6 libxi6 \
    libxrandr2 libxfixes3 libxdamage1 libxcomposite1 \
    libxkbcommon0 libxkbcommon-x11-0 \
    libgl1 libglib2.0-0 libgtk-3-0 \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libgbm1 libasound2 \
    supervisor procps dbus-x11 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN playwright install-deps chromium || true

# Patch noVNC — cache la barre "Connected to..."
RUN find /usr/share/novnc -name "*.html" -exec \
    sed -i 's/id="noVNC_control_bar_anchor"/id="noVNC_control_bar_anchor" style="display:none!important"/g' {} \; \
    2>/dev/null || true

# Config Openbox
RUN mkdir -p /root/.config/openbox
COPY openbox-autostart /root/.config/openbox/autostart

COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY . .

RUN mkdir -p /root/Bureau /app/sessions /app/screenshots /var/log/supervisor

EXPOSE 8001 6080

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]