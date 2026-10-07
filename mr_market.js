let stocks = [];
let selectedSymbol = null;

const fmt = (v, digits=2) => Number(v).toLocaleString("en-IE",{maximumFractionDigits:digits});
const pct = v => (v>=0?"+":"") + (v*100).toFixed(1) + "%";

function methodLabel(method){
  return {
    log:"Log-linear · full history",
    log_20y:"Log-linear · 20Y",
    log_10y:"Log-linear · 10Y",
    log_5y:"Log-linear · 5Y",
    linear:"Linear price"
  }[method] || method;
}

function applyTheme(){
  const saved = localStorage.getItem("valuaris-theme");
  if(saved==="dark"){
    document.body.classList.add("dark");
    themeToggle.textContent="☀";
  }
}

themeToggle.addEventListener("click",()=>{
  document.body.classList.toggle("dark");
  const dark=document.body.classList.contains("dark");
  themeToggle.textContent=dark?"☀":"☾";
  localStorage.setItem("valuaris-theme",dark?"dark":"light");
});

function renderCompanyList(){
  marketCompanyList.innerHTML=stocks.map(s=>`
    <button class="company-btn ${s.symbol===selectedSymbol?"selected":""}" data-symbol="${s.symbol}">
      <span class="ticker">${s.symbol}</span><strong>${s.name}</strong>
    </button>`).join("");

  document.querySelectorAll("[data-symbol]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      selectedSymbol=btn.dataset.symbol;
      renderCompanyList();
      loadHistory();
    });
  });
}

function currencyLabel(stock){
  return stock.currency==="GBp" ? "GBp" : stock.currency;
}

function moodFromRatio(r){
  if(r<0.8) return "Far below trend";
  if(r<0.95) return "Below trend";
  if(r<=1.05) return "Near trend";
  if(r<=1.2) return "Above trend";
  return "Far above trend";
}

function drawChart(rows){
  const svg=marketChart;
  svg.innerHTML="";
  if(!rows.length) return;

  const W=1200,H=560,pad={l:70,r:30,t:30,b:50};
  const values=rows.flatMap(r=>[r.close,r.trend]).filter(v=>Number.isFinite(v)&&v>0);
  let min=Math.min(...values), max=Math.max(...values);
  const extra=(max-min)*0.06 || 1;
  min-=extra; max+=extra;

  const x=i=>pad.l+i/(rows.length-1)*(W-pad.l-pad.r);
  const y=v=>pad.t+(max-v)/(max-min)*(H-pad.t-pad.b);

  const ns="http://www.w3.org/2000/svg";
  function el(name,attrs={}){
    const e=document.createElementNS(ns,name);
    Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));
    return e;
  }

  for(let k=0;k<=4;k++){
    const yy=pad.t+k*(H-pad.t-pad.b)/4;
    svg.appendChild(el("line",{x1:pad.l,y1:yy,x2:W-pad.r,y2:yy,class:"chart-grid"}));
    const val=max-k*(max-min)/4;
    const txt=el("text",{x:pad.l-12,y:yy+4,"text-anchor":"end",class:"chart-label"});
    txt.textContent=fmt(val,0);
    svg.appendChild(txt);
  }

  const pricePoints=rows.map((r,i)=>`${x(i)},${y(r.close)}`).join(" ");
  const trendPoints=rows
    .map((r,i)=>r.trend&&r.trend>0?`${x(i)},${y(r.trend)}`:null)
    .filter(Boolean)
    .join(" ");

  svg.appendChild(el("polyline",{points:pricePoints,class:"price-line"}));
  svg.appendChild(el("polyline",{points:trendPoints,class:"trend-line"}));

  const yearMarks=6;
  for(let k=0;k<yearMarks;k++){
    const i=Math.round(k*(rows.length-1)/(yearMarks-1));
    const txt=el("text",{x:x(i),y:H-18,"text-anchor":"middle",class:"chart-label"});
    txt.textContent=rows[i].date.slice(0,4);
    svg.appendChild(txt);
  }
}

function drawCombined(series){
  const svg=combinedChart;
  svg.innerHTML="";

  const flat=series.flatMap(s=>s.points.map(p=>p.ratio)).filter(v=>Number.isFinite(v)&&v>0);
  if(!flat.length) return;

  const W=1200,H=520,pad={l:70,r:30,t:30,b:50};
  let min=Math.max(0.2,Math.min(...flat)*0.95);
  let max=Math.max(1.2,Math.max(...flat)*1.05);

  const allDates=series.flatMap(s=>s.points.map(p=>p.date)).sort();
  const minDate=new Date(allDates[0]).getTime();
  const maxDate=new Date(allDates[allDates.length-1]).getTime();

  const x=date=>pad.l+(new Date(date).getTime()-minDate)/(maxDate-minDate)*(W-pad.l-pad.r);
  const y=v=>pad.t+(max-v)/(max-min)*(H-pad.t-pad.b);

  const ns="http://www.w3.org/2000/svg";
  function el(name,attrs={}){
    const e=document.createElementNS(ns,name);
    Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));
    return e;
  }

  for(let k=0;k<=4;k++){
    const val=max-k*(max-min)/4;
    const yy=y(val);
    svg.appendChild(el("line",{x1:pad.l,y1:yy,x2:W-pad.r,y2:yy,class:"chart-grid"}));
    const txt=el("text",{x:pad.l-12,y:yy+4,"text-anchor":"end",class:"chart-label"});
    txt.textContent=val.toFixed(2)+"×";
    svg.appendChild(txt);
  }

  svg.appendChild(el("line",{x1:pad.l,y1:y(1),x2:W-pad.r,y2:y(1),class:"value-one-line"}));

  series.forEach((s,idx)=>{
    const pts=s.points
      .filter(p=>Number.isFinite(p.ratio)&&p.ratio>0)
      .map(p=>`${x(p.date)},${y(p.ratio)}`)
      .join(" ");

    if(pts){
      svg.appendChild(el("polyline",{points:pts,class:`combined-line line-${idx%6}`}));
    }

    const last=s.points[s.points.length-1];
    if(last){
      const label=el("text",{
        x:W-pad.r-4,
        y:y(last.ratio)-6,
        "text-anchor":"end",
        class:`combined-label line-${idx%6}`
      });
      label.textContent=s.symbol+" "+last.ratio.toFixed(2)+"×";
      svg.appendChild(label);
    }
  });
}

async function loadHistory(){
  const method=regressionMethod.value;
  const response=await fetch(`/api/history/${encodeURIComponent(selectedSymbol)}?method=${method}`);
  const data=await response.json();
  const stock=stocks.find(s=>s.symbol===selectedSymbol);
  const reg=data.regression;

  marketName.textContent=stock.name;
  chartTitle.textContent=`${stock.name} — ${methodLabel(method)}`;

  if(!data.history.length || !reg){
    marketPrice.textContent="No data";
    marketRatio.textContent="—";
    marketGrowth.textContent="—";
    marketMood.textContent="—";
    drawChart([]);
    return;
  }

  const latest=data.history[data.history.length-1];
  marketPrice.textContent=`${fmt(latest.close)} ${currencyLabel(stock)}`;
  marketRatio.textContent=reg.price_vs_trend ? reg.price_vs_trend.toFixed(2)+"×" : "—";
  marketGrowth.textContent=pct(reg.annual_growth);
  marketMood.textContent=reg.price_vs_trend ? moodFromRatio(reg.price_vs_trend) : "—";
  chartSubtitle.textContent=`${data.history[0].date} → ${latest.date} · ${data.history.length.toLocaleString()} trading days`;
  drawChart(data.history);
}

async function loadCombined(){
  const response=await fetch(`/api/mr-market-all?method=${regressionMethod.value}`);
  const data=await response.json();
  drawCombined(data.series);
}

regressionMethod.addEventListener("change",()=>{
  loadHistory();
  loadCombined();
});

async function init(){
  applyTheme();
  const response=await fetch("/api/stocks");
  stocks=await response.json();

  if(stocks.length){
    selectedSymbol=stocks[0].symbol;
    renderCompanyList();
    loadHistory();
    loadCombined();
  }
}
init();
