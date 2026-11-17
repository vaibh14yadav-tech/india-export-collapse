# Which Export Markets Will Collapse Next Year? An Early-Warning Model for Trade Collapses

**ES 335 Machine Learning, IIT Gandhinagar, 2026** · Vaibhav Yadav (25110335), individual project

**Website:** https://vaibh14yadav-tech.github.io/india-export-collapse/  ·  **Code:** https://github.com/vaibh14yadav-tech/india-export-collapse

---

## 1. What this project is about

India exports almost a hundred kinds of products to more than two hundred countries. Most of these trade flows are fairly stable from one year to the next, but every year some of them suddenly fall: a country stops buying Indian rice, steel sales to a buyer halve, or a market for medicines disappears. For an exporter, an export-credit insurer or a government trade office, it would be useful to know **in advance** which flows are most at risk, so they can check on those buyers first.

This project asks one question:

> **Using only what is known at the end of a year, is it possible to predict which of India's export flows will collapse in the following year?**

To make the question precise:

* **One row of data** is India's exports of one product group to one country in one year. For example, "India's medicine exports to Nigeria in 2015" is one row. There are 96 product groups (the 2-digit groups of the international HS product codes).
* **A collapse** means that next year's exports in that row fall by more than about a quarter (26%), or stop completely. About 22% of rows collapse in a normal year.
* **The prediction is made at the end of the year**, using only that year's and earlier numbers. Nothing from the following year is ever used as an input.
* **The output** is a risk score between 0 and 1 for every flow. The 10% of flows with the highest scores form a **watch list**: the short list of flows someone should look at first.

The model only predicts risk. It does not decide what anyone should do: whether a warning is worth acting on depends on how big the flow is and how costly it is to act, which the model does not know. The model also finds patterns that tend to come *before* a collapse; it does not explain what *causes* one.

## 2. The data

### Where it comes from

| Source | What I use from it | How to get it |
|---|---|---|
| **CEPII BACI** (HS92, version 202601) | Every country's trade with every other country, product by product, for 1995-2024, in thousands of US dollars | Free download from the CEPII website (BACI page). File: `BACI_HS92_V202601.zip`, about 2.4 GB |
| **CEPII Gravity** (version 202211) | Facts about each pair of countries: distance, shared border, shared language, WTO membership, trade agreements | Free download from the CEPII website (Gravity page). File: `Gravity_csv_V202211.zip` |
| **World Bank** (World Development Indicators) | Each buying country's GDP and population | Read directly into the notebook from `https://raw.githubusercontent.com/datasets/gdp/main/data/gdp.csv` and `.../datasets/population/main/data/population.csv` |

The raw files are too large to store on GitHub, so this repository only contains the small result files that the website reads (in `docs/data/`).

### How the raw data becomes the final table

1. **Read 30 years of BACI.** For every year, I keep India's exports to each country, and each country's total imports from the whole world. Products are grouped from 6-digit codes into the 96 two-digit product groups. This gives **405,322** India export records.
2. **Fill in the missing years with zero.** BACI only lists trades that happened. If India stopped selling a product to a country, that row simply disappears. Without filling these gaps, the worst collapses (complete stops) would be invisible. After filling, there are **591,060** rows for 19,702 country-product pairs, and 31% of them are zero years.
3. **Work with changes on a log scale.** Trade values range from $1 million to tens of billions, so values are put on a log scale and yearly changes are measured as log changes. A log change of −0.3 means a fall of about 26%, and rises and falls of the same size become symmetric.
4. **Add the other data.** Each row gets the buying country's GDP and population from the World Bank, and distance, language, border and trade-agreement facts from the Gravity file.
5. **Keep only meaningful flows.** I drop flows smaller than $1 million in a year, because tiny shipments jump up and down randomly and would add noise. I also drop rows whose next year is not known yet, and rows where India sold nothing to that buyer the year before (this year's change cannot be computed). So brand-new and restarting flows are outside the scope of the model: it only scores flows that traded in both of the last two years.

The final table has **131,550 rows**, covering data years 1996 to 2023, and **21.9%** of them collapse the following year.

### Checks and known gaps

* At every step the notebook prints check numbers (for example, India's total exports in 2015 and the value of one specific flow) to make sure each step worked as intended.
* The World Bank often has not yet published GDP for the latest year, so that value is left blank. The models are able to handle blanks.
* The Gravity file ends in 2021, so later years reuse the last known values. Distance and language do not change, so this matters very little.
* **Country-code changes show up as fake stops.** When a country code is retired in BACI, its flows drop to zero and are counted as complete stops. For example, the Netherlands Antilles was dissolved in 2010, so its 2010 flows count as 2011 collapses, and three of them are on the 2011 watch list. The largest case is the Southern African Customs Union (SACU): BACI reports it as one buyer until 1999 and its countries separately after, so 47 SACU flows count as stops in 1999. This and Serbia and Montenegro (split in 2006) affect only training years. These cases are few and were not removed.

## 3. What the model looks at, and why each input was chosen

Every input was chosen from a simple economic idea of why a trade flow might fall. The one data-driven check was the number of past yearly changes (3, 5 or 7), done on the walk-forward years 2011-2020 in an exploratory run that is not saved in this repository; the frozen 2021-2024 years were never used for it. I did not search through hundreds of possible inputs to find the ones that happened to score best, because that can produce patterns that are just luck. All 24 inputs use only information available at the end of the year.

**The flow's own history (7 inputs).** The best guide to a flow's future is often its own past.

| Input | What it is | Why it was chosen |
|---|---|---|
| Size | The flow's value that year (on a log scale) | Big, established flows are usually more stable than small ones |
| Change this year, last year, 2 years ago | How much the flow rose or fell in each of the last 3 years | A flow that just jumped often falls back; one that keeps falling may keep falling. Three years was enough: using 5 or 7 years of changes improved AUC by only about 0.001 |
| Volatility | How much the flow has swung up and down over the last 5 years | Flows that swing a lot are more likely to have a big drop. 5 years is a trade-off: with yearly data, fewer years gives too few numbers for a steady estimate, and more years lets old swings that no longer matter dominate. It is the same window commonly used for a stock's beta, which is often estimated from 5 years (60 months) of returns. I did not tune this window; it was fixed before testing |
| 3-year trend | The overall change over the last 3 years | Separates a flow that is slowly shrinking from one that is growing |
| Years traded (of last 5) | In how many of the last 5 years India sold this product to this country at all | New or on-and-off flows are fragile and stop easily |

**The buyer's market (6 inputs).** A flow can fall because the buyer wants less, or because the buyer switches to other sellers.

| Input | What it is | Why it was chosen |
|---|---|---|
| Buyer's imports of this product | How much the country's imports of this product (from everyone) grew | If the country is buying less of the product overall, India's sales will likely fall too |
| Buyer's total imports | How much the country's imports of everything grew | A sign of a wider slowdown or crisis in the buying country |
| India's market share, and its change | India's share of the country's imports of this product, and how it moved | A falling share means other sellers are winning the market |
| India's exports of this product to all countries | How India's sales of this product to the whole world changed | Separates a problem with this buyer from a problem with India's supply of the product |
| Buyer's weight in India's exports | How important this country is among India's buyers | Large, important partners tend to be more stable relationships |

**The buying country (8 inputs).** Slow-moving facts about the buyer and its link to India.

| Input | What it is | Why it was chosen |
|---|---|---|
| GDP growth | How fast the buyer's economy grew | A shrinking economy buys less |
| Size of economy, population | The buyer's share of world GDP and population | Small economies have smaller, less stable markets |
| Distance | Distance between India and the buyer | Far-away trade is costlier and easier to drop |
| Shared border, shared language | Whether the two countries share a border or an official language | Close, familiar trading partners tend to keep trading |
| WTO membership, trade agreement | Whether the buyer is in the WTO and has a trade agreement with India | Trade rules and agreements make sudden barriers less likely |

**India's other flows (3 inputs).** Collapses tend to come in groups.

| Input | What it is | Why it was chosen |
|---|---|---|
| Other products to this buyer that fell | Share of India's *other* products to this country that fell sharply this year | If many flows to one country are falling, that country may be in trouble |
| Average change of other products to this buyer | Average change of India's *other* products to this country | The same idea, measured as an average |
| This product falling in other countries | Share of *other* countries where this same product fell sharply | If a product is falling everywhere, the problem is the product, not the buyer |

The row's own value is always left out of these three, so the model never sees its own number twice.

**Did the inputs help?** Section 6 shows a test that adds the groups one at a time: the flow's history alone gives an AUC of 0.722, and each extra group raises it a little, to 0.731 with all 24.

## 4. The methods compared

A model is only useful if it beats simple rules that anyone could apply. So the project compares learning models against simple baselines:

| Method | What it does | Why it is included |
|---|---|---|
| **Random guessing** | Picks flows at random | The floor: its watch list is right only as often as flows collapse in general (about 23%) |
| **Volatility rule** | Ranks flows by how much they have swung over the last 5 years. No learning involved | The main baseline. It is the first thing a trade analyst would try, and any model must beat it to be worth using |
| **Jump rule** | Ranks flows by how much they rose this year | A second simple baseline, because many of the riskiest flows turn out to be ones that just jumped |
| **Logistic regression** | Adds up the inputs with learned weights and turns the sum into a probability. Blanks are filled with the median and every input is standardised (mean 0, spread 1) inside a pipeline, so the scaling is learned from the training years only | A simple, readable model. It cannot capture combinations such as "jumpy *and* the buyer is shrinking" |
| **Boosted trees** (scikit-learn HistGradientBoosting) | Builds up to 300 small decision trees, each one correcting the mistakes of the trees before it. scikit-learn's default early stopping is on (training sets are over 10,000 rows): it holds back a random 10% of the *training* rows and stops adding trees when they stop helping there. The test year is never involved | **The main model.** It handles skewed values, blanks and combinations of inputs without extra work. No scaling is needed, because a tree split like "volatility above 0.4" works the same at any scale |
| **XGBoost** | The same idea as boosted trees, from a different library | A check that the result does not depend on one library. It is also used for the 2025 watch list because it can show the reasons behind each warning |

The model settings (number of trees, learning rate and so on) were fixed in advance to sensible standard values and were never tuned on the test years.

## 5. How the models were tested

### Why not a normal random split

The usual way to test a model is to shuffle the data and hold some rows back. Here that would be cheating: the model could learn from 2019 and then "predict" 2012, which nobody could do in real life, and the scores would look better than they really are. So every model is tested the way it would actually be used: **it always predicts a year it has never seen.** There are two tests.

### Test 1: walk-forward test (2011-2020)

I pretend to stand at the end of each year and predict the next one, ten times in a row.

* **Example.** To predict which flows collapse in **2013**, the model is trained only on rows from **2011 and earlier**, because their outcomes (what happened in 2012 and before) were already known at the end of 2012. The model is then given each flow's **2012** numbers as inputs and asked which flows will collapse in 2013. Its predictions are compared with what really happened in 2013.
* The 2012 rows are not used for training in this step, because their outcome *is* 2013, the year being predicted. They become training data one step later, when the model predicts 2014.
* This is repeated for each year from 2011 to 2020, retraining the model every time with the newly known year added. The results reported for this test are the **average over these 10 years**.

### Test 2: frozen post-COVID test (2021-2024)

COVID disrupted world trade, so I also check whether a model built on the pre-COVID world still works afterwards.

* The model is trained **once**, on all rows whose outcome was known by 2020, and then **frozen**: it is never retrained or adjusted again.
* That same frozen model predicts 2021, 2022, 2023 and 2024. The results reported for this test are the **average over these 4 years**.
* None of these four years was used to make any choice in the project, so this is the cleanest and most honest test.

### How the predictions are scored

* **AUC.** Take one flow that collapsed and one that did not. AUC is how often the method gives the collapsed flow the higher risk score. 0.5 means no better than a coin flip; 1.0 would be perfect.
* **Watch list hit rate.** Of the 10% of flows a method flags as riskiest, the share that really collapsed. This matches the real use: a team that only has time to check one flow in ten.
* **PR-AUC and Brier score** are also calculated in the notebooks. Plain accuracy is not used, because 78% of flows do not collapse, so a model that always says "no collapse" would already be 78% accurate while being useless.
* **Is the difference just luck?** Flows to the same country tend to move together, so I re-ran the comparison 500 times, each time on a random mix of countries (a "bootstrap"), and looked at how much the model's advantage over the volatility rule varies.

## 6. Results

| Method | AUC, walk-forward 2011-20 | Watch list right, walk-forward 2011-20 | AUC, frozen 2021-24 | Watch list right, frozen 2021-24 |
|---|---|---|---|---|
| Random guessing | 0.500 | 22.9% | 0.500 | 20.1% |
| Jump rule | 0.617 | 52.4% | 0.601 | 46.2% |
| Volatility rule (main baseline) | 0.694 | 47.0% | 0.701 | 44.3% |
| Logistic regression | 0.711 | 53.3% | 0.719 | 50.8% |
| **Boosted trees (main model)** | **0.731** | **54.2%** | **0.733** | **51.4%** |
| XGBoost | 0.735 | 54.9% | 0.735 | 51.8% |

**Stronger simple baselines.** To check whether all 24 inputs are needed, I also ran two small trees with the same tests, in the same run as everything else (analysis notebook, Step 5b):

| Method | AUC, walk-forward 2011-20 | Watch list right, 2011-20 | AUC, frozen 2021-24 | Watch list right, 2021-24 |
|---|---|---|---|---|
| Tree on 2 inputs (this year's change + volatility) | 0.713 | 52.7% | 0.711 | 48.6% |
| Tree on the flow's own history (7 inputs) | 0.722 | 54.4% | 0.726 | 50.8% |
| Full model (24 inputs) | 0.731 | 54.2% | 0.733 | 51.4% |

Most of the skill comes from the flow's own history: even 2 inputs beat the volatility rule. The other 17 inputs add a small gain in AUC (+0.008 in 2011-2020, +0.007 in 2021-2024) and almost nothing on the watch list (−0.2 and +0.7 points).

**Stricter target.** If a collapse means the flow **halves or stops** (log change below −0.69, 10.2% of rows), the model still beats the volatility rule: AUC 0.821 vs 0.779 in 2011-2020 and 0.819 vs 0.783 in 2021-2024; watch list right 41% vs 35% and 38% vs 33% (random: 10% and 9%).

**Are the risk scores honest percentages?** Splitting all out-of-sample flows into 10 equal groups by risk, the real collapse rate is within about 2.3 points of the average predicted risk in every group (for example 55% predicted vs 54% real in the riskiest tenth). Brier score 0.153. No calibration step was applied after training.

**What these results show:**

* **The model beats the main baseline in every year.** Boosted trees score higher than the volatility rule in all 10 walk-forward years and in all 4 frozen post-COVID years. The model still works after COVID without retraining.
* **The gain is real but modest.** On average the model's AUC is 0.04 higher than the volatility rule's. In the 500-times bootstrap check, the 95% range of the gain is **+0.031 to +0.043** in 2011-2020 and **+0.024 to +0.041** after COVID. Both ranges stay above zero, so the gain is not luck in which countries happened to be tested. For the watch-list hit rate the gain over the rule is +7.2 points (95% range +5.1 to +9.2) in 2011-2020 and +7.1 points (+5.1 to +9.3) after COVID.
* **The watch list is right about half the time,** more than twice as often as random guessing. With a watch list of about 600 flows a year, being right 54% instead of 47% of the time means roughly 40 more real collapses caught per year for the same amount of checking.
* **The jump rule is not enough on its own.** Its watch list does better than the volatility rule's (52% vs 47%), but its AUC is much lower (0.62), because it ranks the rest of the flows badly. The model beats it on AUC in all 14 years and on watch-list hits in 11 of 14.
* **The watch list does not catch every collapse.** Across 2011-2024 it caught **4,408 of 18,295** collapses (24%); the volatility rule's list caught 21%. A list holding 10% of flows cannot contain all of the roughly 22% that collapse. It is a short list of the clearest risks, not a net that catches everything.
* **Which inputs help.** Using only the flow's own history already gives an AUC of 0.722. Adding the buyer's market, the country facts and India's other flows raises it step by step to 0.731.

## 7. Where the model fails (error analysis)

The model makes two kinds of mistakes: **false alarms** (on the watch list, but no collapse) and **missed collapses** (collapsed, but not on the list). Looking at where these happen shows two clear patterns.

**Failure 1: steady flows hit by a sudden shock from the buyer.** The watch list catches 41% of collapses among the jumpiest third of flows, but only 0.4% among the steadiest third, even though steady flows still collapse about 10% of the time. When missed collapses are compared with caught ones:
* missed collapses are much more often steady flows (21% vs 0.3%);
* they are milder falls (median −43% vs −69%);
* in 26% of them, the buying country's total imports fell by more than 10% in the year being predicted, compared with 15% for flows in general.

That shock happens in the year being predicted, so no input could have shown it in advance. The model relies heavily on a flow's own past, and a steady past says "safe". Faster information about the buyer (monthly trade data, currency or credit stress) or a separate model for steady flows could help.

**Failure 2: "lumpy" products crowd the watch list.** Fuel, gems and gold, aircraft, ships and arms are sold in a few huge one-off deals, so their values swing wildly. They are only 4% of all flows but 12% of the watch list. Many of these warnings are correct, but they push other flows off the list, and a warning that "an aircraft sale will not repeat" is rarely useful. The website marks these products and lets visitors hide them.

**Big flows.** For flows over $100M, the model is no better than the volatility rule (AUC 0.753 vs 0.752). Both do well on big flows, but the simple rule is already as good there. The model adds most of its value on small and medium flows, which are about 90% of all flows.

## 8. Limitations

* The improvement over a simple rule is real but modest (about 0.04 AUC), and about half of the model's correct warnings are flows the volatility rule also flags.
* The model cannot foresee shocks that leave no trace in past trade, such as bans, wars, sanctions or sudden policy changes.
* The 2-digit product groups are broad. "Machinery" mixes very different goods, and a collapse in one part can be hidden by growth in another.
* The 26% cut-off is a choice. A different cut-off would ask a slightly different question.
* **Many collapses are spikes falling back.** A collapse is measured against this year's value, so a flow that jumps 4× and gives back a quarter counts. 27% of all collapses end at or above the level of two years earlier, and 30% came right after the flow at least doubled. Much of the watch list is this kind of flow. A target measured against a 3-year average would separate real lost markets from jumps falling back.
* **2024 GDP is carried forward.** 2024 GDP was not yet published, so the 2025 list uses each country's latest known GDP (64 of 6,487 flows still have none). This is an approximation.
* **Risk scores were checked, not adjusted.** They match real collapse rates within about 2.3 points in every tenth of flows, but no calibration step was applied after training.
* **Timing.** BACI data for a year is published about 13 months after the year ends, so in real use a warning would arrive after most of the next year has passed, and the "2025 watch list" describes a year that has already ended.
* The years 2011-2020 were used both to develop the project and to report results. Settings were fixed in advance, but the frozen 2021-2024 test is the cleanest result.
* The model is built and tested only on India's exports.

## 9. The website

The website presents the whole project section by section, with interactive charts. It has two tools:

* **2025 watch list:** the final model scores India's 2024 flows to predict collapses in 2025. You can pick a country or product group and see each flow's risk together with the three inputs that pushed its risk up most.
* **Check a past year:** pick any year from 2011 to 2024 and see what the watch list would have said, and what really happened to each flow.

## 10. Where the numbers come from

Every number in this README and on the website was produced by running the code in the two notebooks in `notebooks/`. Nothing was typed in by hand. The notebooks are saved with their outputs, so they can be opened directly on GitHub to see each result printed under the code that produced it:

* `export_collapse_full.ipynb`, **Steps 1-8**: building the data table, with the check numbers.
* `export_collapse_full.ipynb`, **Step 11**: the walk-forward results (2011-2020) for the volatility rule, logistic regression, boosted trees and XGBoost.
* `export_collapse_full.ipynb`, **Step 12**: the frozen post-COVID results, year by year from 2021 to 2024.
* `analysis_and_website_data.ipynb`, **Step 4**: random guessing, the jump rule, the year-by-year scores and the bootstrap check.
* `analysis_and_website_data.ipynb`, **Step 5b**: the two small-tree baselines, the stricter "halves" target, the calibration check and the spike numbers.
* `analysis_and_website_data.ipynb`, **Steps 5-7**: which inputs help, the error analysis and the 2025 watch list (with 2024 GDP carried forward).

The website's charts and tables read their numbers from the files in `docs/data/`, which the second notebook writes.

**A note on differences between runs:** the website and this README use one run of the notebooks. The outputs saved inside `notebooks/` come from a second run on Google Colab with slightly different library versions. Overall averages differ only in the third decimal (for example 4,417 instead of 4,408 collapses caught, boosted-trees AUC 0.730 instead of 0.731), but single-year watch-list hit rates can differ by up to about 2 points. This changes one count: the model beats the jump rule's watch list in 11 of 14 years in the site's run and 13 of 14 in the saved notebooks. The main conclusions are the same. `notebooks/extra_baselines.py` is a short stand-alone version of the small-tree and spike checks; the numbers reported above come from Step 5b of the analysis notebook.

**Package versions:** `requirements.txt` pins the versions of the run behind the website and this README. The saved notebook outputs came from Google Colab's versions at the time, which explains the small differences above.

**Note on the Gravity file:** CEPII's current Gravity zip contains more than one CSV, so the notebook now picks `Gravity_V202211.csv` by name instead of taking the first CSV.

## 11. How to run it yourself

Both notebooks run on Google Colab, which already has all the required libraries.

1. Download the two CEPII zip files into your Google Drive. Open `notebooks/export_collapse_full.ipynb` in Colab and click **Runtime → Run all**. It builds the data table and tests all the models. The first run takes 10-20 minutes because it reads the large BACI file; it then saves smaller files to your Drive, so later runs take a few minutes. You should see **131,550 rows**, a collapse share of **0.219**, and an average AUC of about 0.69 for the volatility rule and 0.73 for boosted trees.
2. Open `notebooks/analysis_and_website_data.ipynb` and run all. It produces the error analysis, the bootstrap check, the 2025 watch list and the website's data files (saved in `My Drive/website_data`).
3. To update the website, copy those three files into `docs/data/`.

All models use a fixed random seed (0), so running them again gives the same results on the same library versions.

## 12. What's in this repository

```
├── README.md                               # this file
├── requirements.txt                        # Python packages used
├── notebooks/
│   ├── export_collapse_full.ipynb          # builds the data table, trains and tests all models
│   └── analysis_and_website_data.ipynb     # error analysis, bootstrap, 2025 watch list, website data
└── docs/                                   # the website (GitHub Pages)
    ├── index.html, style.css, app.js
    └── data/                               # small result files made by the second notebook
```

## 13. AI-use disclosure

* An AI assistant (Claude, by Anthropic) was used throughout the project: to plan it, to explain each step, and to write most of the code, the website and this README.
* I built the first part of the data table myself in my own Colab notebook, following the assistant's step-by-step instructions and checking each step against fixed check numbers. The final notebooks in `notebooks/` were written by the assistant and run by me.
* All code was run, and every number reported comes from that code. I reviewed the AI-written code and text and I am responsible for the content.

## 14. Citations

* Gaulier, G. and Zignago, S. (2010). BACI: International Trade Database at the Product-Level. The 1994-2007 Version. CEPII Working Paper 2010-23.
* Conte, M., Cotterlaz, P. and Mayer, T. (2022). The CEPII Gravity Database. CEPII Working Paper 2022-05.
* World Bank. World Development Indicators: GDP (current US$) and Population, total. Accessed through the `datasets/gdp` and `datasets/population` repositories on GitHub.
* Pedregosa, F. et al. (2011). Scikit-learn: Machine Learning in Python. *Journal of Machine Learning Research*, 12, 2825-2830.
* Chen, T. and Guestrin, C. (2016). XGBoost: A Scalable Tree Boosting System. *Proceedings of KDD 2016*, 785-794.
* Lundberg, S. M. and Lee, S.-I. (2017). A Unified Approach to Interpreting Model Predictions. *Advances in Neural Information Processing Systems 30*.
