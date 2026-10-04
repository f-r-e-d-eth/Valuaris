const stocks = [
  {ticker:"APPL", name:"Apple", price:176, min:190, max:240, growth:6.0, shares:50},
  {ticker:"MSFT", name:"Microsoft", price:362, min:310, max:400, growth:8.0, shares:25},
  {ticker:"GOOG", name:"Alphabet", price:128, min:170, max:230, growth:9.0, shares:40},
  {ticker:"AMZN", name:"Amazon", price:142, min:160, max:220, growth:10.0, shares:20},
  {ticker:"BRK", name:"Berkshire Hathaway", price:402, min:440, max:560, growth:6.0, shares:15},
  {ticker:"ASML", name:"ASML", price:648, min:520, max:700, growth:9.0, shares:0},
  {ticker:"NOVO", name:"Novo Nordisk", price:92, min:130, max:190, growth:8.0, shares:30},
  {ticker:"LVMH", name:"LVMH", price:694, min:620, max:780, growth:6.0, shares:10},
  {ticker:"V", name:"Visa", price:246, min:220, max:300, growth:8.0, shares:0},
  {ticker:"NESN", name:"Nestlé", price:91, min:95, max:130, growth:4.0, shares:35}
];

let years = 5;
let requiredReturnRate = 2.0;
const eur = v => new Intl.NumberFormat("en-IE",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(v);
const one = v => new Intl.NumberFormat("en-IE",{maximumFractionDigits:1}).format(v);

function future(v,g){ return v * Math.pow(1 + g/100, years); }
function discountedFuture(v,g){ return future(v,g) / Math.pow(1 + requiredReturnRate/100, years); }
function midpoint(s){ return (s.min+s.max)/2; }

function renderCompanies(){
  companyList.innerHTML = stocks.map(s => `<button class="company-btn"><span class="ticker">${s.ticker}</span><strong>${s.name}</strong></button>`).join("");
}

function renderRows(){
  stockRows.innerHTML = stocks.map((s,i)=>{
    const fvMin=future(s.min,s.growth), fvMax=future(s.max,s.growth);
    const ratio=s.price/midpoint(s);
    const pos=Math.max(3,Math.min(97,(ratio/1.5)*100));
    const discountedMin=discountedFuture(s.min,s.growth);
    const discountedMax=discountedFuture(s.max,s.growth);
    const discountedMid=(discountedMin+discountedMax)/2;
    const futureRatio=s.price/discountedMid;
    const futurePos=Math.max(3,Math.min(97,(futureRatio/1.5)*100));
    let text= ratio < .85 ? "Below value" : ratio > 1.15 ? "Above value" : "Around value";
    return `
      <tr>
        <td><div class="company-name"><span class="company-logo">${s.ticker.slice(0,2)}</span>${s.name}</div></td>
        <td class="price">${eur(s.price)}</td>
        <td><div class="range-inputs">
          <input class="num" type="number" min="0" step="1" value="${s.min}" data-i="${i}" data-field="min" aria-label="${s.name} intrinsic minimum">
          <span>–</span>
          <input class="num" type="number" min="0" step="1" value="${s.max}" data-i="${i}" data-field="max" aria-label="${s.name} intrinsic maximum">
        </div></td>
        <td><input class="num growth" type="number" step="0.1" value="${s.growth}" data-i="${i}" data-field="growth"></td>
        <td class="future-value">${eur(fvMin)} – ${eur(fvMax)}</td>
        <td><input class="num shares" type="number" min="0" step="1" value="${s.shares}" data-i="${i}" data-field="shares"></td>
        <td class="valuation">
          <div class="valuation-track"><i class="valuation-dot" style="left:${pos}%"></i></div>
          <div class="valuation-text">${one(ratio)}× midpoint · ${text}</div>
        </td>
      </tr>`;
  }).join("");

  document.querySelectorAll("input[data-i]").forEach(input=>{
    input.addEventListener("input", e=>{
      const i=+e.target.dataset.i, field=e.target.dataset.field;
      let value=Number(e.target.value);
      if(!Number.isFinite(value)) value=0;
      stocks[i][field]=value;
      normalize(i,field);
      update();
    });
  });
}

function normalize(i,field){
  const s=stocks[i];
  if(field==="min" && s.min>s.max) s.max=s.min;
  if(field==="max" && s.max<s.min) s.min=s.max;
  if(s.shares<0) s.shares=0;
}

function calculatePortfolio(){
  return stocks.reduce((a,s)=>{
    if(s.shares<=0) return a;
    a.market += s.price*s.shares;
    a.min += s.min*s.shares;
    a.max += s.max*s.shares;
    a.futureMin += future(s.min,s.growth)*s.shares;
    a.futureMax += future(s.max,s.growth)*s.shares;
    a.owned++;
    return a;
  },{market:0,min:0,max:0,futureMin:0,futureMax:0,owned:0});
}

function updateSummary(p){
  portfolioMarket.textContent=eur(p.market);
  portfolioIntrinsic.textContent=`${eur(p.min)} – ${eur(p.max)}`;
  portfolioFuture.textContent=`${eur(p.futureMin)} – ${eur(p.futureMax)}`;
  stocksOwned.textContent=`${p.owned} / ${stocks.length}`;
  futureLabel.textContent=`${years}Y intrinsic value`;
  futureTableHeading.innerHTML=`${years}Y value<br><small>(EUR / share)</small>`;

  ownedDots.innerHTML=stocks.map(s=>`<i class="dot ${s.shares>0?"on":""}"></i>`).join("");

  const max=Math.max(p.market,p.max,p.futureMax,1);
  marketBar.style.width=`${p.market/max*100}%`;
  intrinsicBarMin.style.width=`${p.min/max*100}%`;
  intrinsicBarMax.style.width=`${p.max/max*100}%`;
  futureBarMin.style.width=`${p.futureMin/max*100}%`;
  futureBarMax.style.width=`${p.futureMax/max*100}%`;

  const mid=(p.min+p.max)/2;
  portfolioRatio.textContent=mid? `Market / value: ${(p.market/mid).toFixed(2)}×` : "—";
}

function updateBars(p){
  const rows=[
    ["Market value",p.market,"market"],
    ["Intrinsic · conservative",p.min,"cons"],
    ["Intrinsic · optimistic",p.max,"opt"],
    [`${years}Y · conservative`,p.futureMin,"future-min"],
    [`${years}Y · optimistic`,p.futureMax,"future-max"]
  ];
  const max=Math.max(...rows.map(r=>r[1]),1);
  portfolioBars.innerHTML=rows.map(([label,value,cls])=>`
    <div class="pb-row ${cls}">
      <span class="pb-label">${label}</span>
      <span class="pb-value">${eur(value)}</span>
      <div class="pb-track"><div class="pb-fill" style="width:${value/max*100}%"></div></div>
    </div>`).join("");
}

function update(){
  renderRows();
  const p=calculatePortfolio();
  updateSummary(p);
  updateBars(p);
}

document.querySelectorAll(".horizon").forEach(btn=>{
  btn.addEventListener("click",()=>{
    years=+btn.dataset.years;
    document.querySelectorAll(".horizon").forEach(b=>b.classList.toggle("active",b===btn));
    update();
  });
});

requiredReturn.addEventListener("change", e=>{
  requiredReturnRate = Math.max(0, Number(e.target.value) || 0);
  e.target.value = requiredReturnRate.toFixed(1);
  update();
});

const savedTheme = localStorage.getItem("valuaris-theme");
if(savedTheme === "dark"){
  document.body.classList.add("dark");
  themeToggle.textContent = "☀";
}
themeToggle.addEventListener("click", ()=>{
  document.body.classList.toggle("dark");
  const dark = document.body.classList.contains("dark");
  themeToggle.textContent = dark ? "☀" : "☾";
  localStorage.setItem("valuaris-theme", dark ? "dark" : "light");
});

renderCompanies();
update();
