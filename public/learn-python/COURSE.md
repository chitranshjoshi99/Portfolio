# Nebula Academy — Course Index

> Gamified 3D training station for Python & Machine Learning.
> Format: **Read a line, write a line** — every step pairs a concept card with a one-line coding mission, verified in a simulated terminal.

**App:** [index.html](index.html) · fully client-side · progress saved in `localStorage`

---

## Curriculum at a glance

| Tier | Module | Codename | Subject | Steps | XP/step | Unlocks |
|------|--------|----------|---------|-------|---------|---------|
| 🐍 Beginner | Launch Protocol | `CORE-01` | Core Python Logic | 5 | 15 | Apprentice |
| 🧮 Apprentice | Telemetry Matrix | `DATA-01` | NumPy & Pandas | 4 | 20 | Pro |
| 🧠 Pro | Model Calibration | `ML-01` | Scikit-learn & TensorFlow | 4 | 30 | — |

Each module pays a **+50 XP completion bonus**. Total course XP: **425** (Level 5 · Rank Archon path).

---

## 🐍 CORE-01 · Launch Protocol — *Beginner*

Core Python logic: signals, variables, loops and functions.

| # | Step | Concept | You write |
|---|------|---------|-----------|
| 1 | The print() Beacon | `print()`, string literals, quotes | `print("Hello, Nebula")` |
| 2 | Variables: Cargo Containers | assignment `=`, numbers vs strings | `fuel = 100` |
| 3 | The for Loop: Countdown Engine | `for` … `in range(5)`, colon, indented body | `for i in range(5):` |
| 4 | Functions Must Return | `def`, parameters, `return` vs `None` | `return remaining` |
| 5 | Calling the Machine | function calls, argument order, storing results | `result = burn_fuel(100, 40)` |

**Live feedback:** terminal simulation only. Completion badge: **Core Online 🐍**

---

## 🧮 DATA-01 · Telemetry Matrix — *Apprentice*

NumPy & Pandas on live probe telemetry. Right panel shows a **live data matrix** that reacts to every verified step.

| # | Step | Concept | You write |
|---|------|---------|-----------|
| 1 | NumPy Arrays: Vectorized Cargo | `np.array`, element-wise ops, no loops | `speeds = np.array([88, 132, 99, 145])` |
| 2 | Aggregation: One Number From Many | mean `x̄ = Σxᵢ / n`, array methods | `avg = speeds.mean()` |
| 3 | Pandas DataFrames: Labelled Tables | `pd.DataFrame`, columns, index | `df = pd.DataFrame(probes)` |
| 4 | Boolean Masks: Filtering Rows | comparison → mask → `df[mask]` | `fast = df[df["speed"] > 100]` |

**Live feedback:** speed column highlight → mean chip → indexed DataFrame → filtered rows.
Completion badge: **Data Wrangler 🧮**

---

## 🧠 ML-01 · Model Calibration — *Pro*

Calibrate an anomaly-detection model. Right panel plots a **live loss/accuracy graph** that reacts to every verified step.

| # | Step | Concept | You write |
|---|------|---------|-----------|
| 1 | Train / Test Split | holdout sets, `test_size=0.2` | `X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)` |
| 2 | Learning Rate: The Throttle | gradient descent `θ ← θ − η·∇L(θ)`, divergence | `optimizer = Adam(learning_rate=0.01)` |
| 3 | Epochs: Full Passes | underfitting vs overfitting, training history | `history = model.fit(X_train, y_train, epochs=50)` |
| 4 | ReLU: The Nonlinear Spark | activations, `ReLU(x) = max(0, x)` | `model.add(Dense(64, activation="relu"))` |

**Live feedback:** 80/20 split bar → diverging loss (lr=5.0) → smooth descent → val_acc 0.94 → calibrated 0.97.
Completion badge: **Model Whisperer 🧠**

---

## Commendations (badges)

| Badge | Name | Earned by |
|-------|------|-----------|
| 📡 | First Signal | Complete your first mission step |
| 🐍 | Core Online | Finish the Beginner module |
| 🧮 | Data Wrangler | Finish the Apprentice module |
| 🧠 | Model Whisperer | Finish the Pro module |
| 🔥 | Constellation Streak | Train 3 days in a row |
| 🛰️ | Fully Operational | Complete all three modules |

---

## Progression system

- **XP → Level:** 100 XP per level (`level = xp // 100 + 1`)
- **Ranks:** Cadet → Navigator → Engineer → Commander → Archon
- **Streak:** consecutive training days, tracked on first XP of each day
- **Tier gating:** Apprentice requires Beginner complete; Pro requires Apprentice
- **Replay:** completed modules replayable — no duplicate XP
- **Certificate:** exportable JSON completion receipt with verification code
- **Reset:** wipes all local progress (confirmation required)
