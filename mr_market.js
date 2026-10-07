let stocks = [];

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
    <a class="company-btn company-link" href="/mr-market/${encodeURIComponent(s.symbol)}">
      <span class="ticker">${s.symbol}</span><strong>${s.name}</strong>
    </a>`).join("");
}

function drawCombined(series){
  const svg=combinedChart;
  svg.innerHTML="";

  const flat=series.flatMap(s=>s.points.map(p=>p.ratio)).filter(v=>Number.isFinite(v)&&v>0);
  if(!flat.length) return;

  const W=1200,H=560,pad={l:70,r:55,t:30,b:50};
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

  const yearMarks=6;
  for(let k=0;k<yearMarks;k++){
    const t=minDate+k*(maxDate-minDate)/(yearMarks-1);
    const txt=el("text",{x:pad.l+k*(W-pad.l-pad.r)/(yearMarks-1),y:H-18,"text-anchor":"middle",class:"chart-label"});
    txt.textContent=new Date(t).getFullYear();
    svg.appendChild(txt);
  }

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
        y:y(last.ratio)-7+(idx*14),
        "text-anchor":"end",
        class:`combined-label line-${idx%6}`
      });
      label.textContent=s.symbol+" "+last.ratio.toFixed(2)+"×";
      svg.appendChild(label);
    }
  });
}

async function loadCombined(){
  const response=await fetch(`/api/mr-market-all?method=${regressionMethod.value}`);
  const data=await response.json();
  drawCombined(data.series);
}

regressionMethod.addEventListener("change",loadCombined);

async function init(){
  applyTheme();
  const response=await fetch("/api/stocks");
  stocks=await response.json();
  renderCompanyList();
  loadCombined();
}
init();
