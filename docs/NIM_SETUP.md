# NVIDIA NIM — non-PHI setup template

NIM is an optional inference provider for **non-PHI** work only. The hosted API
(`integrate.api.nvidia.com`) has no BAA. PHI-bearing AI stays on Vertex AI
(`server/services/ai-gateway.ts`).

## Allowed
- Public content, marketing copy, SEO, localization of non-clinical strings
- Synthetic or de-identified-by-construction test data, dev tooling
- Embeddings and reranking of public text

## Not allowed
- Anything from a patient record, or derived from one
- Self-hosted NIM for PHI, until compliance has reviewed it and the guard is updated

## Wire-up (any project)
1. Copy `server/lib/nim-client.ts` and the NIM check from `scripts/phi-ai-guard.sh`.
2. Set `NVIDIA_API_KEY` (key from build.nvidia.com). Optional `NVIDIA_NIM_BASE_URL` for a self-hosted endpoint.
3. Add each calling file to `scripts/phi-nim-allowlist.txt` (one repo-relative path per line).
4. Call `nimChat(model, messages)` or `nimEmbed(model, inputs)`. Inputs are screened for emails, SSNs, phones,
   dates and long numeric IDs and rejected with `NonPhiInputError`; this is a backstop, not a license to pass PHI.
5. Run `bash scripts/phi-ai-guard.sh` before pushing.
