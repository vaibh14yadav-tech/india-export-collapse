# Extra baselines and spike checks (README section 6 and 8). Reads the table built by export_collapse_full.ipynb.
# Run in Colab after that notebook: python extra_baselines.py
import pandas as pd, numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier as H
from sklearn.metrics import roc_auc_score
TABLE = '/content/drive/MyDrive/my_table.csv'  # change this to where export_collapse_full.ipynb saved the table
d=pd.read_csv(TABLE)
print(len(d), d.collapse.mean().round(3))
c=d[d.collapse==1]
nc=c.next_chg.fillna(-99)
print('collapses ending at/above level 2 yrs earlier (spike undone):', round(((c.chg_0+nc)>=0).mean(),3))
print('collapses where flow had jumped >=50% that year:', round((c.chg_0>=np.log(1.5)).mean(),3), ' doubled:', round((c.chg_0>=np.log(2)).mean(),3))
print('collapses that were stops:', round(c.next_chg.isna().mean(),3))
# true drops below 3-yr-ago level? alt: next value below average of last 3 years
hist=['log_trade','chg_0','chg_1','chg_2','volatility','trend_3y','years_traded_5']
two=['chg_0','volatility']
def run(cols,trainmax,tests):
    tr=d[d.year<=trainmax]; m=H(max_iter=300,learning_rate=0.05,random_state=0).fit(tr[cols],tr.collapse)
    out=[]
    for y in tests:
        te=d[d.year==y]; p=m.predict_proba(te[cols])[:,1]
        k=int(np.ceil(len(te)*0.1)); top=np.argsort(-p)[:k]
        out.append((roc_auc_score(te.collapse,p), te.collapse.values[top].mean()))
    return np.mean(out,axis=0).round(3)
for name,cols in [('two-input tree',two),('history-only tree',hist)]:
    fz=run(cols,2019,[2020,2021,2022,2023])
    wf=np.mean([run(cols,Y-2,[Y-1]) for Y in range(2011,2021)],axis=0).round(3)
    print(name,'WF auc/top10',wf,'frozen',fz)
