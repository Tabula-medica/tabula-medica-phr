# Qwen-Image 2.1 Deployment Checklist

**Branch:** `claude/qwen-image-model-eval-580n4y`  
**Status:** Ready for Implementation Phase 1  
**Date:** 2026-09-21

---

## Pre-Deployment Verification

### Security & Compliance ✅
- [x] Risk assessment completed (see `qwen-image-phi-safe-integration.md`)
- [x] PHI boundary architecture designed
- [x] Safe prompt validation middleware implemented
- [x] Audit logging structure defined
- [ ] Legal review: HIPAA compliance sign-off (pending)
- [ ] Compliance officer: Architecture approval (pending)

### Code Review ✅
- [x] Service implementation (`qwen-image-screening-service.ts`)
- [x] Middleware implementation (`require-qwen-safe-prompt.ts`)
- [x] Route implementation (`qwen-screening-routes.ts`)
- [ ] Peer code review (pending)
- [ ] Security team review (pending)

---

## Phase 1: Local Model Setup & Testing

### 1.1 Model Installation
```bash
# Option A: Using ollama (recommended for simplicity)
# https://github.com/ollama/ollama
curl https://ollama.ai/install.sh | sh
ollama pull qwen-image:2.1-gguf

# Option B: Using llama-cpp-python (lower overhead)
pip install llama-cpp-python
# Download GGUF from HuggingFace manually
```

**Tasks:**
- [ ] Download Qwen-Image 2.1 GGUF (8GB model)
- [ ] Verify checksum: `sha256sum qwen-image-2.1.gguf`
- [ ] Place in `/models/qwen-image-2.1-gguf`
- [ ] Test inference: `ollama run qwen-image "classify this" < test-image.png`
- [ ] Confirm latency < 500ms for classification

### 1.2 Docker Setup (Isolation)
```bash
# Build isolated container
docker build -f docker/qwen-image.Dockerfile -t qwen-screening:latest .

# Run with zero network egress
docker run \
  --network qwen-local-only \
  --cap-drop=NET_RAW \
  -p 7860:7860 \
  -v /models:/qwen-model:ro \
  -e QWEN_SAFE_MODE=true \
  qwen-screening:latest
```

**Tasks:**
- [ ] Create `docker/qwen-image.Dockerfile`
- [ ] Add to `docker-compose.yml` with isolated network
- [ ] Verify zero outbound connections: `docker inspect qwen-screening`
- [ ] Test local-only inference via localhost:7860

### 1.3 Environment Configuration
```bash
# .env.local
QWEN_MODEL_PATH=/models/qwen-image-2.1-gguf
QWEN_INFERENCE_TIMEOUT=5000
QWEN_SAFE_MODE=true
QWEN_ALLOWED_PROMPTS=classification,legibility,quality,signature
QWEN_MAX_PROMPT_LENGTH=500
QWEN_LOG_LEVEL=info
QWEN_ENABLE_AUDIT=true
```

**Tasks:**
- [ ] Set environment variables in `.env.local`
- [ ] Load config in `server/index.ts`: `initializeQwenService(config)`
- [ ] Add to CI/CD secrets (do NOT commit `.env.local`)

---

## Phase 2: Integration & PHI Barrier Testing

### 2.1 Service Integration
```typescript
// In server/index.ts
import { initializeQwenService } from "./services/qwen-image-screening-service";
import { attachQwenScreeningRoutes } from "./routes/qwen-screening-routes";

// Initialize service
initializeQwenService({
  modelPath: process.env.QWEN_MODEL_PATH || "/models/qwen-image-2.1-gguf",
  maxPromptLength: 500,
  allowedPrompts: new Set(["classification", "legibility", "quality", "signature"]),
  timeout: 5000,
  logger,
});

// Attach routes
attachQwenScreeningRoutes(app, logger);
```

**Tasks:**
- [ ] Integrate service initialization in `server/index.ts`
- [ ] Attach routes to Express app
- [ ] Verify routes available: `GET /api/qwen/config`
- [ ] Add Qwen routes to API documentation

### 2.2 Prompt Validation Testing (FUZZ TEST)

**Test safe prompts (SHOULD PASS):**
```bash
# ✅ Should succeed
curl -X POST http://localhost:3000/api/qwen/classify \
  -F "document=@test-image.jpg" \
  -F "qwenPrompt=classify this document type"

# ✅ Should succeed
curl -X POST http://localhost:3000/api/qwen/legibility \
  -F "document=@test-image.jpg"

# ✅ Should succeed
curl -X POST http://localhost:3000/api/qwen/quality \
  -F "document=@test-image.jpg"
```

**Test unsafe prompts (SHOULD FAIL):**
```bash
# ❌ Should be BLOCKED (contains PHI keyword)
curl -X POST http://localhost:3000/api/qwen/classify \
  -F "document=@test-image.jpg" \
  -F "qwenPrompt=extract patient name and date of birth"
# Expected: 400 UNSAFE_PROMPT

# ❌ Should be BLOCKED (PHI extraction attempt)
curl -X POST http://localhost:3000/api/qwen/classify \
  -F "document=@test-image.jpg" \
  -F "qwenPrompt=read insurance ID and member number"
# Expected: 400 UNSAFE_PROMPT

# ❌ Should be BLOCKED (medical diagnosis)
curl -X POST http://localhost:3000/api/qwen/classify \
  -F "document=@test-image.jpg" \
  -F "qwenPrompt=does this ECG show arrhythmia"
# Expected: 400 UNSAFE_PROMPT

# ❌ Should be BLOCKED (treatment decision)
curl -X POST http://localhost:3000/api/qwen/classify \
  -F "document=@test-image.jpg" \
  -F "qwenPrompt=recommend medication based on lab results"
# Expected: 400 UNSAFE_PROMPT
```

**Tasks:**
- [ ] Run 20+ safe prompt tests → all should pass
- [ ] Run 20+ unsafe prompt tests → all should be blocked
- [ ] Verify no PHI keywords bypass middleware
- [ ] Check logs: confirm blocked requests logged to security team

### 2.3 Audit Logging Verification

**Verify logs contain NO PHI:**
```bash
# Check logs (should show only labels, not content)
tail -f logs/qwen-screening.log

# Expected format:
# {"docId":"doc-123","classification":"lab_report","processingMs":345,"timestamp":"2026-09-21T..."}

# NOT expected (would be PHI violation):
# {"docId":"doc-123","extractedText":"John Doe, DOB 01/15/1990,..."}
```

**Tasks:**
- [ ] Verify logs contain: docId, classification, processingMs, timestamp only
- [ ] Verify logs DO NOT contain: image data, OCR text, extracted names, dates
- [ ] Set log retention: 30 days (match PHI policy)
- [ ] Add logs to `ai-compliance-monitoring.ts`

---

## Phase 3: Compliance Integration

### 3.1 Compliance Monitoring Integration
```typescript
// In server/services/ai-compliance-monitoring.ts
export async function logQwenScreening(
  result: QwenScreeningResult
): Promise<void> {
  await complianceMonitor.log({
    component: "qwen-image-screening",
    operationType: "document-classification",
    phiExposure: "none",
    processingMs: result.processingTimeMs,
    classification: result.classification,
    timestamp: result.timestamp,
    riskLevel: "low",
    complianceStatus: "hipaa_compliant",
  });
}
```

**Tasks:**
- [ ] Add Qwen logging to `ai-compliance-monitoring.ts`
- [ ] Mark as "non-PHI processing" in compliance reports
- [ ] Add to `ai-security-posture.ts` → report as "low-risk layer"
- [ ] Generate compliance report showing zero PHI exposure

### 3.2 HIPAA Audit Trail
**Capture:**
- [x] Service initialization timestamp
- [x] Model path and version (Qwen 2.1)
- [x] Each screening operation (docId, result, time)
- [ ] Blocked prompt attempts (logged as security event)
- [ ] System resource usage (CPU, memory, disk)

**Tasks:**
- [ ] Create audit log entry: model initialization
- [ ] Create audit log entry: each screening operation
- [ ] Create security alert: each blocked PHI extraction attempt
- [ ] Export audit trail: `GET /api/admin/audit/qwen` (admin only)

### 3.3 Security Review
- [ ] Compliance officer sign-off: PHI isolation architecture
- [ ] Security team sign-off: prompt validation rules
- [ ] Legal review: uncensored model usage (non-clinical context)
- [ ] CISO approval: isolated network deployment

---

## Phase 4: Performance Validation

### 4.1 Latency Testing
```bash
# Test 10 images (med quality, 2-3MB each)
# Measure: classification, legibility, quality, full screen

# Expected:
# - Classification: 200-400ms
# - Legibility: 150-300ms
# - Quality: 100-200ms
# - Full screen: 400-800ms (parallel)
```

**Tasks:**
- [ ] Run latency test suite: `npm run test:qwen-latency`
- [ ] Verify p95 < 1000ms per classification
- [ ] Document baseline performance
- [ ] Alert if p50 > 600ms (degradation)

### 4.2 Throughput Testing
```bash
# Simulate concurrent document screening
# 50 concurrent uploads, measure queue depth and latency

# Expected:
# - Queue depth: < 10
# - Latency tail: p99 < 3s
# - Error rate: < 0.1%
```

**Tasks:**
- [ ] Load test: 50 concurrent users
- [ ] Measure queue depth, error rate, tail latency
- [ ] Verify system stable under load
- [ ] Document resource requirements (CPU, RAM, disk)

### 4.3 Accuracy Validation
```bash
# Test on 100 real (anonymized) documents from production

# Measure accuracy:
# - Document type classification: aim for > 95%
# - Legibility detection: aim for > 98%
# - Quality issues: aim for > 90% precision
```

**Tasks:**
- [ ] Prepare anonymized test dataset (100 docs)
- [ ] Compare Qwen output vs ground truth
- [ ] Calculate precision, recall, F1 score per class
- [ ] Document results in `/logs/qwen-validation-report.json`

---

## Phase 5: Deployment

### 5.1 Pre-Production Testing
- [ ] Deploy to staging environment
- [ ] Run full test suite: unit + integration + compliance
- [ ] Verify audit logging works end-to-end
- [ ] Compliance officer sign-off on staging

### 5.2 Production Canary Rollout
```bash
# Week 1: 5% of incoming documents
# Week 2: 25% (if stable)
# Week 3: 100% (full rollout)

# Monitor:
# - Error rate < 0.1%
# - Latency p50 < 400ms, p99 < 1000ms
# - Zero PHI leakage incidents
# - Audit log completeness 100%
```

**Tasks:**
- [ ] Enable feature flag: `QWEN_SCREENING_ENABLED=false`
- [ ] Deploy with 5% canary: `QWEN_SCREENING_CANARY_PERCENT=5`
- [ ] Monitor metrics for 24h
- [ ] Increase to 25%, then 100% based on stability
- [ ] Create runbook: "Disable Qwen if PHI leak detected"

### 5.3 Runbook & Playbooks
Create post-deployment docs:
- [ ] `/docs/qwen-screening-runbook.md` — operational procedures
- [ ] `/docs/qwen-disable-emergency.md` — emergency disable procedure
- [ ] `/docs/qwen-troubleshooting.md` — common issues
- [ ] `/docs/qwen-audit-export.md` — audit trail export procedure

---

## Post-Deployment (Ongoing)

### 6.1 Monthly Compliance Audit
- [ ] Export audit logs: `GET /api/admin/audit/qwen?month=09`
- [ ] Verify zero PHI in logs
- [ ] Check blocked prompt attempts (should be near zero)
- [ ] Validate retention: logs older than 30 days archived

### 6.2 Quarterly Performance Review
- [ ] Run accuracy validation on new documents
- [ ] Compare to baseline (from Phase 4)
- [ ] Report ROI: hours saved per month
- [ ] Recommend model version upgrades if needed

### 6.3 Annual Security Review
- [ ] Penetration test: attempt PHI extraction via API
- [ ] Review source code for compliance drift
- [ ] Update documentation if rules change
- [ ] Confirm legal/compliance sign-off still valid

---

## Rollback Procedure

**If ANY of these occur → IMMEDIATELY DISABLE Qwen:**

1. **PHI Leakage Detected**
   ```bash
   # Set flag
   QWEN_SCREENING_ENABLED=false
   # Restart app
   # Alert: Compliance Officer, Security, CISO
   # Scope: Audit all outputs from past 24h
   ```

2. **Unsafe Prompts Not Blocked**
   - Disable immediately
   - Review middleware logic
   - Audit for bypasses
   - Retest before re-enabling

3. **Audit Logging Failure**
   - Every screening must log
   - If logging fails → disable screening
   - No exceptions

4. **Lateral Access Attempt**
   - If someone tries to call Qwen with PHI
   - Disable and investigate
   - Review network isolation

---

## Success Criteria

| Criteria | Target | Status |
|----------|--------|--------|
| **Compliance** | 0 PHI leakage incidents | Pending |
| **Security** | 100% of unsafe prompts blocked | Pending |
| **Audit** | 100% of operations logged (no PHI) | Pending |
| **Performance** | p95 latency < 1000ms | Pending |
| **Accuracy** | Classification > 95% | Pending |
| **Uptime** | > 99.5% (7d rolling) | Pending |
| **Sign-offs** | Legal, Compliance, Security | Pending |

---

## Approval Sign-Off

Once all phases complete:

- [ ] **Legal Counsel:** Uncensored model approved for non-PHI screening  
  Signature: _________________ Date: _______

- [ ] **Compliance Officer:** Architecture isolates PHI; zero exposure  
  Signature: _________________ Date: _______

- [ ] **Security Officer:** Network isolation, audit logging verified  
  Signature: _________________ Date: _______

- [ ] **VP Engineering:** Performance targets met, production-ready  
  Signature: _________________ Date: _______

---

## Questions?

- **Technical Issues:** Raise in GitHub Issue with `[qwen-image]` tag
- **Compliance Questions:** Escalate to Compliance Officer
- **Security Concerns:** Email security@tabula-medica.internal
- **Performance Optimization:** Post in internal Slack #tabula-eng

---

**Next Step:** Schedule Legal review meeting to discuss Phase 1 findings.
