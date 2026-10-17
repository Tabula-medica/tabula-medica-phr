FROM python:3.12-slim

WORKDIR /app

# Copy the analysis library first (cache layer)
COPY ekg14cardio/ ./ekg14cardio/

# Install service deps then the library
COPY service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir -e "./ekg14cardio[llm]"

COPY service/main.py .

# Non-root user for Cloud Run / HIPAA hardening
RUN useradd -m svc
USER svc

ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT} --workers 2 --log-level info"]
