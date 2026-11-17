# Which Export Markets Will Collapse Next Year? An Early-Warning Model for Trade Collapses

**ES 335 Machine Learning, IIT Gandhinagar, 2026** · Vaibhav Yadav (25110335), individual project

**Live website:** https://vaibh14yadav-tech.github.io/india-export-collapse/  ·  **Code:** https://github.com/vaibh14yadav-tech/india-export-collapse

---

## 1. Question

> Using only what is known at the end of year t, which of India's export flows (one product group to one country) will **collapse** in year t+1?

* **One row** = India's exports of one HS 2-digit product group to one country in one year.
* **Target (collapse)** = next year's value falls by more than 26% (log change below −0.3) or drops to zero.
* **Prediction time** = end of year t. Every input uses year t or earlier.
* **Decision it supports** = which flows to review first (a watch list of the 10% riskiest). The model predicts risk; it does not decide what to do.
* Results are predictive associations, not causal effects.

## 2. Main results

Walk-forward test (answer years 2011-2020, retrained every year) and frozen post-COVID test (trained once on answers up to 2020, scored on 2021-2024 without retraining).

| Method | AUC 2011-20 | Top-10% hit rate 2011-20 | AUC 2021-24 (frozen) | Top-10% hit rate 2021-24 |
|---|---|---|---|---|
| Random picking | 0.500 | 22.9% | 0.500 | 20.1% |
| Jump rule (rank by this year's rise) | 0.617 | 52.4% | 0.601 | 46.2% |
| Volatility rule (baseline) | 0.694 | 47.0% | 0.701 | 44.3% |
| Logistic regression | 0.711 | 53.3% | 0.719 | 50.8% |
| **Boosted trees (main model)** | **0.731** | **54.2%** | **0.733** | **51.4%** |
| XGBoost | 0.735 | 54.9% | 0.735 | 51.8% |

* Boosted trees beat the volatility rule in **10 of 10** walk-forward years and **4 of 4** frozen years.
* The watch list (top 10% of flows) caught **4,408 of 18,295** collapses in 2011-2024 (24%; the volatility rule's list caught 21%).
* For flows over $100M the gain is close to zero (AUC 0.753 vs 0.752).
* Resampling whole countries 500 times (bootstrap), the AUC gain over the rule is **+0.037** (95% range 0.031 to 0.043) walk-forward and **+0.032** (0.024 to 0.041) frozen.
* **Main failure mode:** steady flows hit by a sudden shock from the buyer. The watch list catches 41% of collapses among the jumpiest third of flows, but only 0.4% among the steadiest third. Lumpy products (fuel, gems, aircraft, ships, arms) are 4% of flows but 12% of the watch list.

## 3. Data access

No data files are stored in this repository except the small result files the website reads (`docs/data/`).

| Source | What is used | How to get it |
|---|---|---|
| CEPII BACI, HS92, version 202601 | Bilateral trade by 6-digit product, 1995-2024 (US$ thousands) | Free download from the CEPII website (BACI page). File: `BACI_HS92_V202601.zip`, about 2.4 GB |
| CEPII Gravity, V202211 | Distance, border, language, WTO, trade agreements | Free download from the CEPII website (Gravity page). File: `Gravity_csv_V202211.zip` |
| World Bank WDI (GDP, population) | GDP (current US$) and population of each buyer | Read directly in the notebook from `https://raw.githubusercontent.com/datasets/gdp/main/data/gdp.csv` and `.../datasets/population/main/data/population.csv` |

Put both CEPII zip files in the top folder of your Google Drive (`My Drive`).

## 4. How to reproduce

Both notebooks run on Google Colab (scikit-learn, XGBoost, pandas and matplotlib are already installed there).

1. Open `notebooks/export_collapse_full.ipynb` in Colab and choose **Runtime → Run all**.
   It builds the table from the raw BACI zip (10-20 minutes the first time; it saves `my_india_hs2.csv` and `my_world_imports_hs2.csv` to Drive so later runs take seconds), then runs the walk-forward and frozen tests.
   Check numbers: grid 591,060 rows; final table **131,550 rows**, collapse share **0.219**; average AUC rule 0.694, boosted trees 0.730-0.731.
2. Open `notebooks/analysis_and_website_data.ipynb` and run all. It rebuilds the out-of-sample predictions, the bootstrap, the ablation, the error analysis and the 2025 watch list, and writes `summary.json`, `watchlist_2025.json` and `past_watchlists.json` to `My Drive/website_data`.
3. Copy those three files into `docs/data/`. To preview the site locally: `python3 -m http.server 8000 --directory docs`, then open http://localhost:8000.

The website and this README use one run of the notebooks; the saved Colab outputs in `notebooks/` come from a second run with slightly different library versions, so a few numbers differ in the third decimal (for example 4,417 vs 4,408 collapses caught, trees AUC 0.730 vs 0.731). The conclusions are the same. All models use `random_state=0`. Model settings were fixed in advance and are the same for every test year; the 2021-2024 years were not used for any choice.

## 5. Repository structure

```
├── README.md
├── requirements.txt
├── notebooks/
│   ├── export_collapse_full.ipynb          # raw BACI -> table (Steps 1-8), models and tests (Steps 9-14)
│   └── analysis_and_website_data.ipynb     # bootstrap, ablation, error analysis, 2025 watch list, website JSON
└── docs/                                   # GitHub Pages website
    ├── index.html, style.css, app.js
    └── data/                               # JSON written by the second notebook
```

## 6. Method summary

* **Preprocessing:** India's exports and every country's imports summed from 6-digit products to 96 HS 2-digit groups; every buyer-product pair filled with zeros for missing years (so full stops are visible); values on a log scale and changes as log changes; flows under $1M dropped.
* **24 inputs:** flow history (7), market (6), country and gravity (8), co-movement of India's other flows (3). All known at the end of year t.
* **Baselines:** random, and the volatility rule (rank by the spread of the last 5 yearly changes).
* **Models:** logistic regression (median imputation and scaling inside a pipeline), scikit-learn HistGradientBoosting (main), XGBoost (comparison, and SHAP reasons for the 2025 watch list).
* **Evaluation:** walk-forward by year; frozen post-COVID test; AUC, top-10% hit rate, PR-AUC, Brier score; country-level bootstrap.

## 7. AI-use disclosure

* An AI assistant (Claude, by Anthropic) was used throughout the project: to plan it, to explain each step, and to write most of the code, the website and this README.
* I built the first part of the data table myself in my own Colab notebook, following the assistant's step-by-step instructions and checking each step against fixed check numbers. The final notebooks in `notebooks/` were written by the assistant and run by me.
* All code was run, and every number reported comes from that code. I reviewed the AI-written code and text and I am responsible for the content.

## 8. Citations

* Gaulier, G. and Zignago, S. (2010). BACI: International Trade Database at the Product-Level. The 1994-2007 Version. CEPII Working Paper 2010-23.
* Conte, M., Cotterlaz, P. and Mayer, T. (2022). The CEPII Gravity Database. CEPII Working Paper 2022-05.
* World Bank. World Development Indicators: GDP (current US$) and Population, total. Accessed through the `datasets/gdp` and `datasets/population` repositories on GitHub.
* Pedregosa, F. et al. (2011). Scikit-learn: Machine Learning in Python. *Journal of Machine Learning Research*, 12, 2825-2830.
* Chen, T. and Guestrin, C. (2016). XGBoost: A Scalable Tree Boosting System. *Proceedings of KDD 2016*, 785-794.
* Lundberg, S. M. and Lee, S.-I. (2017). A Unified Approach to Interpreting Model Predictions. *Advances in Neural Information Processing Systems 30*.
