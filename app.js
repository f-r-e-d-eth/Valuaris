let stocks = [];
let years = 5;
let requiredReturnRate = 2.0;

const STORAGE_KEY = "valuaris-assumptions";

const one = v => new Intl.NumberFormat("en-IE",{maximumFractionDigits:1}).format(v);

function money(v, currency){
  if(v === null || v === undefined || !Number.isFinite(Number(v))) return "—";
  const n=Number(v);
  if(currency==="GBp") return one(n)+" GBp";
  try{
    return new Intl.NumberFormat("en-IE",{
      style:"currency",
      currency,
      maximumFractionDigits:n>=100 ? 0 : 2
    }).format(n);
  }catch{
    return one(n)+" "+currency;
  }
}

function loadAssumptions(){
  try{
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  }catch{
    return {};
  }
}

function saveAssumptions(){
  const data={};
  stocks.forEach(s=>{
    data[s.symbol]={
      min:s.min,
      max:s.max,
      growth:s.growth,
      shares:s.shares
    };
  });
  localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
}

function future(v,g){
  return v * Math.pow(1 + g/100, years);
}

function discountedFuture(v,g){
  return future(v,g) / Math.pow(1 + requiredReturnRate/100, years);
}

function hasValueRange(s){
  return Number.isFinite(s.min) && Number.isFinite(s.max) && s.min>0 && s.max>0;
}

function midpoint(s){
  return hasValueRange(s) ? (s.min+s.max)/2 : null;
}

function renderCompanies(){
  companyList.innerHTML = stocks.map(s => `
    <a class="company-btn company-link" href="/mr-market/${encodeURIComponent(s.symbol)}">
      <span class="ticker">${s.symbol}</span><strong>${s.name}</strong>
    </a>`).join("");
}

function valuationStatus(s){
  const mid=midpoint(s);
  if(!mid || !s.price) return {text:"Add value",ratio:null};
  const ratio=s.price/mid;
  if(ratio<0.85) return {text:"Below value",ratio};
  if(ratio>1.15) return {text:"Above value",ratio};
  return {text:"Around value",ratio};
}

function renderWatchlistSummary(){
  watchlistSummary.innerHTML=stocks.map(s=>{
    const st=valuationStatus(s);
    const ratio=st.ratio ? st.ratio.toFixed(2)+"×" : "—";
    return `
      <a class="watch-row" href="/mr-market/${encodeURIComponent(s.symbol)}">
        <div>
          <strong>${s.name}</strong>
          <span>${s.symbol} · ${money(s.price,s.currency)}</span>
        </div>
        <div class="watch-state">
          <b>${st.text}</b>
          <span>${ratio}</span>
        </div>
      </a>`;
  }).join("");

  const latestDates=stocks.map(s=>s.latestDate).filter(Boolean).sort();
  dataStatus.textContent=latestDates.length ? `Data: ${latestDates[latestDates.length-1]}` : "No data";
}

function renderRows(){
  stockRows.innerHTML = stocks.map((s,i)=>{
    const valid=hasValueRange(s);
    const fvMin=valid ? future(s.min,s.growth) : null;
    const fvMax=valid ? future(s.max,s.growth) : null;
    const ratio=valid && s.price ? s.price/midpoint(s) : null;
    const pos=ratio ? Math.max(3,Math.min(97,(ratio/1.5)*100)) : 50;

    const discountedMin=valid ? discountedFuture(s.min,s.growth) : null;
    const discountedMax=valid ? discountedFuture(s.max,s.growth) : null;
    const discountedMid=valid ? (discountedMin+discountedMax)/2 : null;
    const futureRatio=discountedMid && s.price ? s.price/discountedMid : null;
    const futurePos=futureRatio ? Math.max(3,Math.min(97,(futureRatio/1.5)*100)) : 50;

    return `
      <tr>
        <td>
          <a class="company-name company-link" href="/mr-market/${encodeURIComponent(s.symbol)}">
            <span class="company-logo">${s.symbol.slice(0,2)}</span>${s.name}
          </a>
        </td>
        <td class="price">${money(s.price,s.currency)}</td>
        <td><div class="range-inputs">
          <input class="num" type="number" min="0" step="0.01" value="${s.min ?? ""}" placeholder="min" data-i="${i}" data-field="min" aria-label="${s.name} intrinsic minimum">
          <span>–</span>
          <input class="num" type="number" min="0" step="0.01" value="${s.max ?? ""}" placeholder="max" data-i="${i}" data-field="max" aria-label="${s.name} intrinsic maximum">
        </div></td>
        <td><input class="num growth" type="number" step="0.1" value="${s.growth ?? 0}" data-i="${i}" data-field="growth"></td>
        <td class="future-value">${valid ? money(fvMin,s.currency)+" – "+money(fvMax,s.currency) : "—"}</td>
        <td><input class="num shares" type="number" min="0" step="1" value="${s.shares ?? 0}" data-i="${i}" data-field="shares"></td>
        <td class="valuation">
          <div class="valuation-pair">
            <div class="valuation-row">
              <span class="valuation-label">Today</span>
              <div class="valuation-track">${ratio ? `<i class="valuation-dot" style="left:${pos}%"></i>` : ""}</div>
              <span class="valuation-ratio">${ratio ? one(ratio)+"×" : "—"}</span>
            </div>
            <div class="valuation-row future">
              <span class="valuation-label">${years}Y PV</span>
              <div class="valuation-track">${futureRatio ? `<i class="valuation-dot" style="left:${futurePos}%"></i>` : ""}</div>
              <span class="valuation-ratio">${futureRatio ? one(futureRatio)+"×" : "—"}</span>
            </div>
          </div>
          <div class="valuation-text">${valid ? "PV: "+money(discountedMin,s.currency)+" – "+money(discountedMax,s.currency) : "Add intrinsic-value range"}</div>
        </td>
      </tr>`;
  }).join("");

  document.querySelectorAll("input[data-i]").forEach(input=>{
    input.addEventListener("change", e=>{
      const i=+e.target.dataset.i;
      const field=e.target.dataset.field;
      const raw=e.target.value.trim();

      if((field==="min" || field==="max") && raw===""){
        stocks[i][field]=null;
      }else{
        let value=Number(raw);
        if(!Number.isFinite(value)) value=0;
        stocks[i][field]=value;
      }

      if(field==="shares" && stocks[i].shares<0) stocks[i].shares=0;
      if(field==="growth" && !Number.isFinite(stocks[i].growth)) stocks[i].growth=0;

      saveAssumptions();
      update();
    });
  });
}

function updateSummary(){
  const owned=stocks.filter(s=>s.shares>0).length;
  stocksOwned.textContent=`${owned} / ${stocks.length}`;
  ownedDots.innerHTML=stocks.map(s=>`<i class="dot ${s.shares>0?"on":""}"></i>`).join("");
  futureTableHeading.innerHTML=`${years}Y value<br><small>(native / share)</small>`;
  renderWatchlistSummary();
}

function update(){
  renderRows();
  updateSummary();
}

document.querySelectorAll(".horizon").forEach(btn=>{
  btn.addEventListener("click",()=>{
    years=+btn.dataset.years;
    document.querySelectorAll(".horizon").forEach(b=>b.classList.toggle("active",b===btn));
    update();
  });
});

requiredReturn.addEventListener("change", e=>{
  requiredReturnRate=Math.max(0,Number(e.target.value)||0);
  e.target.value=requiredReturnRate.toFixed(1);
  update();
});

const savedTheme=localStorage.getItem("valuaris-theme");
if(savedTheme==="dark"){
  document.body.classList.add("dark");
  themeToggle.textContent="☀";
}

themeToggle.addEventListener("click",()=>{
  document.body.classList.toggle("dark");
  const dark=document.body.classList.contains("dark");
  themeToggle.textContent=dark?"☀":"☾";
  localStorage.setItem("valuaris-theme",dark?"dark":"light");
});

async function init(){
  const response=await fetch("/api/stocks");
  const apiStocks=await response.json();
  const saved=loadAssumptions();

  stocks=apiStocks.map(s=>{
    const a=saved[s.symbol] || {};
    return {
      symbol:s.symbol,
      name:s.name,
      currency:s.currency,
      price:s.latest ? Number(s.latest.close) : null,
      latestDate:s.latest ? s.latest.date : null,
      min:Number.isFinite(Number(a.min)) && a.min!==null ? Number(a.min) : null,
      max:Number.isFinite(Number(a.max)) && a.max!==null ? Number(a.max) : null,
      growth:Number.isFinite(Number(a.growth)) ? Number(a.growth) : 0,
      shares:Number.isFinite(Number(a.shares)) ? Number(a.shares) : 0
    };
  });

  renderCompanies();
  update();
}

init();
