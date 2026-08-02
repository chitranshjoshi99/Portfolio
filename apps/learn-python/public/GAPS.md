# Course Gap Analysis — `course.json`

**Scope reviewed:** 6 modules × 5 checkpoints × 10 questions = **300 questions**.
**Claim:** "0 → industry AI/ML."
**Verdict:** Solid Python + ML/DL sampler. Not yet industry-ready. Gaps below.

---

## Structural gaps

- 300 Qs total, most one-liners. Fine for drills, thin for mastery.
- No capstones, no multi-file projects, no real datasets, no end-to-end build.
- No prerequisites module (install, `venv`, `pip`, IDE, tracebacks, running scripts).
- No math prereqs (linear algebra, calculus, prob/stats). ML/DL assume them silently.
- No testing / debugging / logging track anywhere.

---

## PY-CORE (Beginner) — missing

- `while`, `break`, `continue`, loop-`else`
- `enumerate`, `zip`, `sorted(key=...)`, `reversed`, `range` deep
- `None`, truthiness, `is` vs `==`
- Scope, `global`, `nonlocal`, closures
- `*args`, `**kwargs`, keyword-only, mutable default gotcha
- Recursion
- String methods beyond f-string (`split`, `join`, `strip`, `format`)
- `input()`, print flushing, basic I/O
- Modules / imports

---

## PY-CRAFT (Apprentice) — missing

- **`pytest` / unit testing** — critical
- **`asyncio` / `async`/`await`** — huge gap
- **`threading`, `multiprocessing`, `concurrent.futures`**
- **`logging` module**
- Std-lib workhorses: `pathlib`, `os`, `json`, `re` (regex), `datetime`, `itertools`, `functools`, `collections` (Counter/defaultdict/deque)
- Context managers (`with`, `contextlib`)
- `dataclasses`
- `ABC` / `Protocol` / structural typing
- Packaging: `pyproject.toml`, entry points, `pip install -e .`
- `argparse` / CLI
- HTTP: `requests` / `httpx`
- SQLite / `sqlalchemy`
- `venv` / deps (`uv`, `poetry`)
- Debugging (`pdb`, `breakpoint()`)
- Git basics

---

## DATA-CORE (Analyst) — missing

- **Visualization absent** — no `matplotlib`, `seaborn`, `plotly`
- **Statistics fundamentals** — mean/median/variance/quantiles/distributions/hypothesis tests / `scipy.stats`
- Pandas gaps: `pivot`, `melt`, `pivot_table`, `apply`, `map`, `transform`, missing data (`isna`, `fillna`, `dropna`), dtypes, categorical, `MultiIndex`
- Time series: `DatetimeIndex`, resample, rolling windows
- I/O: `read_csv` options, `parquet`, `feather`, chunked reads, `to_sql`
- **SQL** — industry-critical, zero coverage
- Big data: `polars` / `dask` / `pyspark`
- EDA workflow, data cleaning, profiling
- Feature engineering breadth (encoding, scaling variants, target encoding, datetime features)

---

## ML-CLASSIC (Engineer) — missing

- **Regression** — only classification shown. No `LinearRegression`, `Ridge`, `Lasso`, RMSE, MAE, R²
- **Unsupervised** — no `KMeans`, `DBSCAN`, hierarchical, PCA, t-SNE, UMAP
- **Gradient boosting** — no `XGBoost`, `LightGBM`, `CatBoost` (industry workhorse)
- SVM, KNN, Naive Bayes
- Metrics beyond accuracy: precision, recall, F1, ROC/AUC, PR curve, confusion matrix, log loss
- CV strategies: `StratifiedKFold`, `TimeSeriesSplit`, `GroupKFold`, nested CV
- Class imbalance: `class_weight`, SMOTE, resampling
- Feature selection (RFE, mutual info, tree importances)
- Regularization theory (L1/L2 explicit)
- Bias/variance, learning curves, validation curves
- Calibration, threshold tuning
- Interpretability: SHAP, permutation importance, LIME
- Bayesian optimization / Optuna (only grid search shown)
- Save / load models (`joblib`)

---

## DL-NEURAL (Architect) — missing + ordering issue

- **Checkpoint order inverted.** "Training Loop" as CP1 needs tensors + autograd + modules first. Reorder: tensors → autograd → layers → optimizers → training loop.
- **No `Dataset` / `DataLoader`** — PyTorch cornerstone
- **No CNN** — `Conv2d`, pooling, image models
- **No RNN/LSTM proper** — one-liner exists, no sequence-modeling context
- **No Transformer / attention** — biggest omission for "industry AI/ML"
- **No BatchNorm, LayerNorm, Dropout**
- **No loss zoo** — `CrossEntropyLoss`, `BCEWithLogitsLoss`, `MSELoss`
- LR schedulers, warmup, weight decay
- Weight init (Xavier, He)
- Regularization, early stopping (implementation)
- Mixed precision (`torch.cuda.amp`), gradient clipping, gradient accumulation
- Transfer learning / fine-tuning pretrained models (torchvision, HF)
- Multi-GPU: `DataParallel`, DDP, `torchrun`
- TensorBoard / W&B / MLflow
- Checkpointing, resume training
- ONNX / TorchScript export, inference optimization

---

## GENAI-FORGE (Pro) — missing

- **Prompt engineering** — few-shot, chain-of-thought, ReAct, self-consistency, system prompts
- **Fine-tuning** — LoRA, QLoRA, PEFT, SFT, DPO, RLHF concepts
- **Quantization / inference** — bitsandbytes, GGUF, `vLLM`, TGI, `llama.cpp`
- **Evaluation** — perplexity, BLEU, ROUGE, MMLU-style, LLM-as-judge, RAGAS
- **Guardrails / safety** — prompt injection, jailbreaks, PII redaction, output validation
- **Structured output** — JSON mode, `pydantic` + `instructor` / `outlines`
- **Chunking strategies** — recursive, semantic, hierarchical
- **Reranking** — cross-encoders, Cohere rerank
- **Hybrid search** — BM25 + dense fusion
- **Chat memory / conversation state**
- **Streaming, batching, cost/latency/caching**
- **Attention / transformer architecture** — no conceptual bridge from DL to LLM
- Multi-modal: CLIP, Whisper, GPT-4V
- Frameworks: LangChain, LlamaIndex, DSPy, LangGraph, CrewAI
- Vector DBs beyond Chroma — pgvector, Pinecone, Qdrant, Weaviate, Milvus
- Observability: Langfuse, Weave, Phoenix
- Serving: FastAPI + streaming, Docker

---

## Missing MLOps / production track entirely

Course claims "industry" but has zero:

- Experiment tracking (MLflow, W&B)
- Model registry / versioning
- Data versioning (DVC)
- Feature stores
- CI/CD for ML
- Monitoring, drift detection, retraining triggers
- Deployment: FastAPI / Flask serving, Docker, Kubernetes, serverless (Lambda, Cloud Run), SageMaker, Vertex, HF endpoints
- Cloud basics (S3, GCS, IAM)
- Reproducibility (seeds, containers, pinned deps)
- Ethics, bias auditing, privacy (GDPR / PII)

---

## Ordering / pedagogy nits

- `PY-CRAFT` — `errors-files` conflates two topics; split.
- `DATA-CORE` — "Telemetry Pipeline" (CP1) is a NumPy warm-up; label mismatch.
- `ML-CLASSIC` — teaches accuracy as headline metric, reinforces bad habit on imbalanced data. Introduce F1 / AUC alongside from day one.
- `DL-NEURAL` — CP order flipped (see above).
- `GENAI-FORGE` — starts at tokenizer with no attention/transformer scaffolding. Students memorize APIs without understanding.

---

## To honestly claim "industry-ready"

1. `PY-CRAFT` — add testing + async + std-lib + packaging
2. `DATA-CORE` — add visualization + stats + SQL
3. `ML-CLASSIC` — add regression + gradient boosting + unsupervised + real metrics + interpretability
4. `DL-NEURAL` — add Dataset/DataLoader + CNN + Transformer + fine-tuning + loss zoo
5. `GENAI-FORGE` — add prompt eng + fine-tuning (LoRA) + eval + safety + serving
6. **New MLOps module** — tracking, registry, serving, monitoring
7. Prereq module (setup, math primers) + one capstone per tier

**Rough add:** ~200–300 more questions + 4–6 project checkpoints.
