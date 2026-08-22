FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /srv/research-api
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app

RUN useradd --create-home --uid 10001 research && chown -R research:research /srv/research-api
USER research

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
