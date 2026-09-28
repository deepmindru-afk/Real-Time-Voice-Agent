FROM python:slim
#ARG PYTHON_VERSION=3.14 #.7
ARG TZ=Europe/Moscow
ENV TZ=Europe/Moscow
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV VIRTUAL_ENV=/opt/venv
ENV UV_HTTP_TIMEOUT=999999
ENV UV_NO_CACHE=1
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
RUN echo "deb http://mirror.yandex.ru/debian/ trixie main contrib non-free" > /etc/apt/sources.list \
&& echo "deb http://mirror.yandex.ru/debian/ trixie-updates main contrib non-free" >> /etc/apt/sources.list \
&& apt update -y && apt install gcc g++ libc++1 libglib2.0-0 git libpq-dev -y && apt autoremove -y && apt autoclean -y \
&& rm -rf /var/lib/apt/lists/*
RUN mkdir -p /app/
WORKDIR /app/
COPY requirements.txt .
RUN python -m pip install --no-cache-dir -U pip wheel uv
RUN uv pip install -U --no-cache-dir --pre --prerelease allow -r requirements.txt
#RUN uv pip install --no-cache --prerelease=allow -U \
#    git+https://github.com/deepmindru-afk/agents.git#subdirectory=livekit-agents \
COPY . .
#RUN python koleso_rt_agent.py download-files
RUN python -m livekit.agents download-files
ENTRYPOINT ["python", "main.py"]

#FROM python:slim
##ARG PYTHON_VERSION=3.14 #.7
#ARG TZ=Europe/Moscow
#ENV TZ=Europe/Moscow
#ENV PYTHONDONTWRITEBYTECODE=1
#ENV PYTHONUNBUFFERED=1
##ENV VIRTUAL_ENV=/opt/venv
##RUN python3 -m venv $VIRTUAL_ENV
##ENV PATH="$VIRTUAL_ENV/bin:$PATH"
#ENV UV_SYSTEM_PYTHON=1
#ENV UV_HTTP_TIMEOUT=999999
#ENV UV_NO_CACHE=1
#RUN echo "deb http://mirror.yandex.ru/debian/ trixie main contrib non-free" > /etc/apt/sources.list \
#    && echo "deb http://mirror.yandex.ru/debian/ trixie-updates main contrib non-free" >> /etc/apt/sources.list \
#    && apt update -y && apt install gcc g++ libc++1 libglib2.0-0 git libpq-dev -y && apt autoremove -y && apt autoclean -y \
#    && rm -rf /var/lib/apt/lists/*
#
#COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
#RUN mkdir -p /app/
#WORKDIR /app/
#COPY requirements.txt .
##RUN python -m pip install --no-cache-dir -U pip wheel uv
#RUN uv pip install -U --no-cache-dir --pre --prerelease allow -r requirements.txt
##RUN uv pip install --no-cache --prerelease=allow -U \
##    git+https://github.com/deepmindru-afk/agents.git#subdirectory=livekit-agents \
#COPY . .
##RUN python koleso_rt_agent.py download-files
#RUN python -m livekit.agents download-files
#ENTRYPOINT ["python", "main.py"]
