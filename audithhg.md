You are the Senior Software Engineer + RAG Architect + QA Engineer + Performance Engineer responsible for performing a FINAL INDEPENDENT VERIFICATION AUDIT of this project.

PROJECT:
Hacker House Goa 2026 — Task 2
Low-Latency Voice RAG System

I have provided the project repository along with the official HH Goa requirements/documentation and the previous project audit documentation.

YOUR TASK:

Perform ONE COMPLETE END-TO-END AUDIT of the CURRENT CODEBASE and determine whether the ACTUAL implementation works according to the provided HH Goa requirements and project documentation.

This is an AUDIT ONLY.

==================================================
                    ABSOLUTE RULE
==================================================

DO NOT MODIFY ANYTHING.

You MUST NOT:

- modify source code
- edit existing files
- refactor code
- fix bugs
- change configuration
- change package versions
- change dependencies
- modify tests
- modify benchmark scripts
- modify datasets
- regenerate vector stores
- change environment files
- change UI
- change API behavior
- delete files
- rename files
- create replacement implementations
- "temporarily" patch anything for testing

You may ONLY:

- inspect files
- search the repository
- execute existing commands
- execute existing tests
- execute existing benchmark scripts
- run the existing application
- make requests to existing APIs
- inspect runtime output
- measure performance
- inspect generated output
- compare implementation against documentation
- create ONE NEW AUDIT REPORT ARTIFACT containing your findings

The ONLY file you are allowed to create is the final audit report.

Do not create any other temporary files inside the project repository.

If a test or command would modify project files, DO NOT run it unless it can safely be executed without modifying the repository.

==================================================
                 AUDIT OBJECTIVE
==================================================

Answer one central question:

"Does the CURRENT CODEBASE actually implement and work according to the official HH Goa Task 2 requirements and the supplied project documentation?"

Do NOT assume that documentation is correct.

Do NOT assume that the previous audit is correct.

Do NOT assume that README claims are correct.

Verify claims against the actual current codebase and runtime behavior.

Every important claim must be classified as:

PASS
FAIL
PARTIALLY WORKING
NOT IMPLEMENTED
DOCUMENTED ONLY
UNKNOWN / UNABLE TO VERIFY

Every PASS must have evidence.

Every FAIL must have reproduction/evidence.

==================================================
              COMPLETE AUDIT SCOPE
==================================================

Perform one comprehensive audit covering ALL of the following together:

- complete repository structure
- source code
- architecture
- dataset
- data ingestion
- preprocessing
- chunking
- embeddings
- vector stores
- BM25
- hybrid retrieval
- score fusion
- RAG pipeline
- context construction
- grounding
- citations
- guardrails
- STT
- LLM
- model/pipeline harness
- frontend
- API routes
- error handling
- retry/timeout behavior
- environment variables
- security
- dependencies
- tests
- benchmarks
- latency
- P50/P70/P100
- build
- production execution
- reproducibility
- Git/submission readiness
- documentation accuracy
- known limitations
- HH Goa compliance

You must inspect the COMPLETE repository rather than only obvious files.

==================================================
          REQUIREMENT VS IMPLEMENTATION
==================================================

Use the OFFICIAL HH Goa Task 2 document as the primary requirement specification.

Use the previous project audit as a set of CLAIMS that must be independently verified.

For each important requirement, determine:

1. What HH Goa requires.
2. What the documentation claims.
3. What the current code actually implements.
4. What happens during runtime.
5. Final status.

Create a clear table:

| Requirement | Documentation Claim | Actual Implementation | Runtime Evidence | Status |

==================================================
              CORE RAG VERIFICATION
==================================================

Verify the complete pipeline:

Voice Input
→ Speech-to-Text
→ Query Processing
→ Chunking/Retrieval
→ Vector/BM25/Hybrid Search
→ Context Construction
→ Grounded Answer Generation
→ Guardrails
→ Citations
→ Final Answer

Trace the actual execution path through the source code.

Do not simply describe the intended architecture.

Determine the architecture that the CURRENT CODE actually executes.

==================================================
                 DATASET
==================================================

Verify:

- actual dataset being used
- whether it is AI4Bharat MSMARCO-XI
- actual number of documents
- whether only a subset is indexed
- preprocessing
- duplicates
- metadata
- query/passage/answer fields
- ingestion process
- precomputed data
- vector-store consistency

If the active system really uses only 500 documents, clearly report that limitation.

==================================================
                 CHUNKING
==================================================

Verify every implemented chunking strategy.

Specifically check whether the claimed strategies actually work:

- Fixed-size
- Overlapping
- Semantic
- Metadata-aware

Do not mark them PASS merely because files or configuration entries exist.

Actually verify their behavior.

Check whether:

- they are implemented
- they are selectable
- they produce different chunk structures
- retrieval actually uses the selected strategy
- precomputed vector stores correspond to the strategy
- chunk parameters are actually applied

==================================================
               EMBEDDINGS
==================================================

Verify the actual embedding implementation.

The documentation claims a 384-dimensional TF-IDF/hash-based representation.

Verify:

- actual dimensionality
- deterministic behavior
- tokenization
- normalization
- similarity calculation
- vector generation
- actual use in retrieval

Do not simply accept the documentation.

==================================================
              VECTOR STORE
==================================================

Verify:

- vector-store loading
- number of documents/chunks
- indexing
- similarity search
- query embedding
- memory behavior
- caching
- startup behavior
- consistency with current dataset/chunking implementation

==================================================
                   BM25
==================================================

Inspect and verify the actual BM25 implementation.

Check:

- tokenization
- stemming
- TF
- IDF
- document length
- k1
- b
- field weighting
- multi-field retrieval
- query processing
- inverted index

If the documentation specifies exact weights or formulas, compare them with the actual implementation.

==================================================
             HYBRID RETRIEVAL
==================================================

Verify exactly how BM25 and vector retrieval are combined.

Check:

- score normalization
- score fusion
- weighting
- ranking
- top-K
- tie handling
- zero-result behavior
- IDF/entity handling
- query preprocessing

Determine whether the documented hybrid retrieval formula is actually implemented.

Test with:

- exact queries
- paraphrases
- entity queries
- short queries
- long queries
- typo queries
- irrelevant queries
- out-of-corpus queries

==================================================
               GROUNDING
==================================================

This is a CRITICAL verification.

Determine whether generated answers are genuinely grounded in retrieved context.

Verify:

- retrieved context is actually used
- unsupported information is rejected
- insufficient context causes refusal
- answer claims correspond to retrieved content
- citations correspond to actual source chunks
- citations cannot be fabricated
- source mapping is correct

Attempt adversarial/unsupported queries where practical.

==================================================
               GUARDRAILS
==================================================

Verify the actual guardrail implementation.

Test:

- greeting
- irrelevant query
- out-of-corpus query
- insufficient context
- unsafe input
- malformed input
- empty input
- very long input
- prompt injection
- instruction override
- hallucination-inducing query

Verify whether the system correctly refuses unsupported answers.

Do not claim "zero hallucination" merely because normal test queries pass.

==================================================
                   STT
==================================================

Verify the actual Sarvam STT implementation.

Check:

- provider
- model
- endpoint
- request format
- audio handling
- MIME validation
- API key handling
- retries
- timeout
- error handling
- response parsing

If external credentials are unavailable, mark runtime verification as:

UNKNOWN / UNABLE TO VERIFY

Do not mark it PASS based only on source-code inspection.

==================================================
                   LLM
==================================================

Audit all LLM-related code.

Determine:

- actual provider/model
- whether it is optional or mandatory
- local synthesis behavior
- cloud LLM behavior
- fallback behavior
- timeout/retry
- structured output
- validation
- hidden dependencies
- legacy providers
- GLM/ZAI references

Search the ENTIRE repository for legacy dependencies and references.

==================================================
             MODEL / PIPELINE HARNESS
==================================================

Verify whether the implementation actually provides the required orchestration/harness behavior.

Check:

- structured stages
- model abstraction
- retries
- timeouts
- validation
- fallback
- error recovery
- telemetry
- model decoupling

Do not mark this PASS just because an abstraction/interface exists.

==================================================
                 FRONTEND
==================================================

Verify actual frontend functionality.

Check:

- microphone recording
- permission handling
- transcript
- transcript editing
- query execution
- loading state
- error state
- refusal state
- answer display
- citations
- source excerpts
- retrieval information
- latency information
- guardrail status
- chunking strategy selection

IMPORTANT:

Search for hardcoded/demo values.

Verify that displayed:

- answers
- citations
- scores
- latency
- benchmark numbers
- status indicators

come from actual backend/runtime data rather than static UI values.

==================================================
                   APIs
==================================================

Audit every API route.

For each route verify:

- request validation
- response structure
- error handling
- timeout
- external calls
- secret handling
- malformed input
- failure behavior

Especially verify the actual STT and RAG routes.

==================================================
                PERFORMANCE
==================================================

Run the EXISTING benchmark system.

Do not modify the benchmark.

Verify whether the documented performance numbers are reproducible.

Measure/report where possible:

- minimum
- average
- P50
- P70
- P90
- P95
- P100

for each relevant chunking strategy.

Clearly separate:

1. embedding latency
2. BM25 latency
3. vector search latency
4. hybrid retrieval latency
5. guardrail latency
6. local RAG pipeline latency
7. STT latency
8. cloud LLM latency
9. end-to-end voice latency

VERY IMPORTANT:

Do not call the complete voice-to-answer pipeline "<50ms" if external STT/LLM latency is excluded.

Determine exactly what the HH Goa <50ms measurement represents in the current implementation.

Also check whether benchmark values are:

- genuinely measured
- hardcoded
- mocked
- cached
- artificially optimized
- excluding important operations

==================================================
                   TESTING
==================================================

Run the existing tests.

Inspect the quality of the tests, not only the count.

Verify whether tests genuinely test:

- embeddings
- chunking
- BM25
- hybrid retrieval
- grounding
- citations
- guardrails
- failure modes
- latency

Report:

- total tests
- passed
- failed
- skipped
- meaningful coverage
- important missing tests

==================================================
                BUILD / RUNTIME
==================================================

Verify:

npm install
npm test
npm run build

and the existing production/dev execution flow where safe.

Check:

- build errors
- TypeScript errors
- runtime errors
- warnings
- missing environment variables
- API failures
- production startup

==================================================
                  SECURITY
==================================================

Inspect:

- API secrets
- .env handling
- .gitignore
- client/server boundaries
- API key exposure
- file upload validation
- MIME validation
- request limits
- prompt injection
- unsafe execution
- dependency risks
- accidental secret exposure

Verify that SARVAM_API_KEY remains server-side.

==================================================
              REPRODUCIBILITY
==================================================

Pretend you are a new developer cloning the repository.

Verify whether the documented setup actually works.

Check:

- dependencies
- environment variables
- dataset setup
- vector stores
- scripts
- Python requirements
- Node requirements
- OS assumptions
- build
- tests
- production execution

Identify anything that exists only on the current developer machine.

==================================================
       DOCUMENTATION VS ACTUAL CODE
==================================================

This MUST be a major section of the final audit.

Independently verify the previous audit's major claims, including but not limited to:

- 4 chunking strategies functional
- 17/17 tests passing
- 112/112 retrieval verification
- hybrid retrieval working
- 384-dimensional embedding
- BM25 implementation
- score fusion
- grounding
- citations
- 5-stage guardrails
- Sarvam STT
- LLM decoupling
- local RAG <50ms
- P50/P70/P100
- 500-document corpus
- production build
- security claims

Create:

| Previous Audit Claim | Actual Finding | Evidence | Status |

==================================================
             BREAK THE SYSTEM
==================================================

Do not only test happy paths.

Try to expose failures using:

- unrelated queries
- adversarial queries
- prompt injection
- empty input
- whitespace
- long input
- Unicode
- punctuation
- spelling mistakes
- unknown entities
- conflicting queries
- insufficient context
- invalid audio
- unsupported MIME
- missing API key
- external API failure where safely testable

Do not modify the code to perform these tests.

==================================================
              FINAL AUDIT ARTIFACT
==================================================

After completing the entire investigation, create ONE professional audit artifact.

Preferred filename:

HHGOA_TASK2_FINAL_CODEBASE_VERIFICATION_AUDIT.md

If the environment specifically supports a better report format, you may additionally create a PDF ONLY if it does not require modifying the project itself.

However, the primary required artifact is:

HHGOA_TASK2_FINAL_CODEBASE_VERIFICATION_AUDIT.md

The report must be self-contained and understandable without reading your conversation.

It must contain:

# HH Goa Task 2 — Final Codebase Verification Audit

## 1. Executive Summary

## 2. Final Verdict

Use exactly one:

🟢 READY
🟡 READY WITH FIXES
🔴 NOT READY

## 3. Overall Compliance Assessment

## 4. Official Requirement vs Actual Implementation

## 5. Previous Audit Claims vs Actual Reality

## 6. Actual Architecture

## 7. Actual End-to-End Data Flow

## 8. Dataset Verification

## 9. Chunking Verification

## 10. Embedding Verification

## 11. Vector Store Verification

## 12. BM25 Verification

## 13. Hybrid Retrieval Verification

## 14. RAG Pipeline Verification

## 15. Grounding Verification

## 16. Citation Verification

## 17. Guardrail Verification

## 18. STT Verification

## 19. LLM / Harness Verification

## 20. Frontend Verification

## 21. API Verification

## 22. Performance Verification

## 23. P50 / P70 / P100 Results

## 24. Testing Verification

## 25. Security Verification

## 26. Reproducibility Verification

## 27. Documentation vs Reality

## 28. Issues Found

For each issue:

- Severity
- Location
- Problem
- Evidence
- Impact
- Reproduction
- Recommended action

IMPORTANT:

The "Recommended action" must ONLY describe what should be fixed.

DO NOT IMPLEMENT THE FIX.

## 29. What Is Already Correct

Explicitly list components that are working correctly and should NOT be unnecessarily changed.

## 30. Critical Issues Before Submission

## 31. High Priority Issues

## 32. Medium/Low Priority Issues

## 33. Known Limitations

## 34. HH Goa Judging Risks

## 35. Final Submission Readiness

==================================================
             EVIDENCE REQUIREMENT
==================================================

Every major conclusion must contain evidence.

Where possible include:

- file path
- function/class
- line number
- command executed
- runtime output
- benchmark result
- test result

Use tables wherever useful.

Do not fill the report with generic explanations.

The report must describe THIS ACTUAL REPOSITORY.

==================================================
              FINAL SAFETY CHECK
==================================================

Before finishing:

1. Confirm that NO existing project file was modified.
2. Confirm that NO source code was changed.
3. Confirm that NO configuration was changed.
4. Confirm that NO tests were changed.
5. Confirm that NO benchmark was changed.
6. Confirm that NO dataset was changed.
7. Confirm that ONLY the final audit artifact was created.
8. Clearly state these confirmations at the end of the report.

FINAL RULE:

AUDIT ONLY.

INSPECT.
EXECUTE.
VERIFY.
MEASURE.
REPORT.

DO NOT FIX.
DO NOT MODIFY.
DO NOT REFACTOR.
DO NOT OPTIMIZE.
DO NOT "IMPROVE" ANYTHING.

Wait for my explicit instruction before making ANY code changes.