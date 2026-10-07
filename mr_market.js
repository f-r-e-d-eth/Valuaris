let stocks = [];
let selectedSymbol = null;

const fmt = (v, digits=2) => Number(v).toLocaleString("en-IE",{maximumFractionDigits:digits});
const pct = v => (v>=0?"+":"") + (v*100).toFixed(1) + "%";

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
  if(selectedSymbol) loadHistory();
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
  const values=rows.flatMap(r=>[r.close,r.trend]).filter(Number.isFinite);
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
    const line=el("line",{x1:pad.l,y1:yy,x2:W-pad.r,y2:yy,class:"chart-grid"});
    svg.appendChild(line);
    const val=max-k*(max-min)/4;
    const txt=el("text",{x:pad.l-12,y:yy+4,"text-anchor":"end",class:"chart-label"});
    txt.textContent=fmt(val,0);
    svg.appendChild(txt);
  }

  const pricePoints=rows.map((r,i)=>`${x(i)},${y(r.close)}`).join(" ");
  const trendPoints=rows.map((r,i)=>`${x(i)},${y(r.trend)}`).join(" ");
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

async function loadHistory(){
  const method=regressionMethod.value;
  const response=await fetch(`/api/history/${encodeURIComponent(selectedSymbol)}?method=${method}`);
  const data=await response.json();
  const stock=stocks.find(s=>s.symbol===selectedSymbol);
  const reg=data.regression;

  marketName.textContent=stock.name;
  chartTitle.textContent=`${stock.name} — ${method==="log"?"Log-linear":"Linear"} trend`;

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
  marketRatio.textContent=reg.price_vs_trend.toFixed(2)+"×";
  marketGrowth.textContent=pct(reg.annual_growth);
  marketMood.textContent=moodFromRatio(reg.price_vs_trend);
  chartSubtitle.textContent=`${data.history[0].date} → ${latest.date} · ${data.history.length.toLocaleString()} trading days`;
  drawChart(data.history);
}

regressionMethod.addEventListener("change",loadHistory);

async function init(){
  applyTheme();
  const response=await fetch("/api/stocks");
  stocks=await response.json();
  if(stocks.length){
    selectedSymbol=stocks[0].symbol;
    renderCompanyList();
    loadHistory();
  }
}
init();
