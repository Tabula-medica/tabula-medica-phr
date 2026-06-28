# Thin image: official LiteLLM proxy + our Vertex-only config baked in.
FROM ghcr.io/berriai/litellm:main-stable

COPY config.yaml /app/config.yaml

# Cloud Run sets $PORT; LiteLLM listens on it. master_key + VERTEX_* come from env.
ENV PORT=4000
EXPOSE 4000
CMD ["--config", "/app/config.yaml", "--port", "4000"]
