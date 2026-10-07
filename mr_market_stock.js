let stocks=[];
let selectedSymbol=decodeURIComponent(location.pathname.split("/").pop());

const fmt=(v,d=2)=>Number(v).toLocaleString("en-IE",{maximumFractionDigits:d});
const pct=v=>(v>=0?"+":"")+(v*100).toFixed(1)+"%";

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
  if(localStorage.getItem("valuaris-theme")==="dark"){
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
    <a class="company-btn company-link ${s.symbol===selectedSymbol?"selected":""}" href="/mr-market/${encodeURIComponent(s.symbol)}">
      <span class="ticker">${s.symbol}</span><strong>${s.name}</strong>
    </a>`).join("");
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
  if(!values.length) return;

  let min=Math.min(...values),max=Math.max(...values);
  const extra=(max-min)*0.06||1;
  min=Math.max(0,min-extra);max+=extra;

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
    .filter(Boolean).join(" ");

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
  const stock=stocks.find(s=>s.symbol===selectedSymbol);
  if(!stock){
    marketName.textContent="Unknown stock";
    return;
  }

  pageTitle.textContent=`Mr. Market — ${stock.name}`;
  const method=regressionMethod.value;
  const response=await fetch(`/api/history/${encodeURIComponent(selectedSymbol)}?method=${method}`);
  const data=await response.json();
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
  marketPrice.textContent=`${fmt(latest.close)} ${stock.currency}`;
  marketRatio.textContent=reg.price_vs_trend ? reg.price_vs_trend.toFixed(2)+"×" : "—";
  marketGrowth.textContent=pct(reg.annual_growth);
  marketMood.textContent=reg.price_vs_trend ? moodFromRatio(reg.price_vs_trend) : "—";
  chartSubtitle.textContent=`${data.history[0].date} → ${latest.date} · ${data.history.length.toLocaleString()} trading days`;
  drawChart(data.history);
}

regressionMethod.addEventListener("change",loadHistory);

async function init(){
  applyTheme();
  const response=await fetch("/api/stocks");
  stocks=await response.json();
  renderCompanyList();
  loadHistory();
}
init();
