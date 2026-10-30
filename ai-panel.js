(function(){
  var LK='btx_ai_log_v1', PK='btx_ai_perf_v1';
  function ld(k,d){ try{ var v=JSON.parse(localStorage.getItem(k)); return v||d; }catch(e){ return d; } }
  function sv(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
  var log=ld(LK,[]), perf=ld(PK,{});
  function hookDecide(){
    if(!window.BTX_AI||!BTX_AI.decide||BTX_AI.decide.__lg) return;
    var o=BTX_AI.decide;
    BTX_AI.decide=function(bars,side,mkt){
      var d=o(bars,side,mkt);
      try{ log.unshift({t:Date.now(),mkt:mkt,side:side,conf:(d&&d.conf),ok:(d&&d.ok),reason:(d&&d.reason),thr:(d&&d.thr),regime:(d&&d.regime)}); if(log.length>200)log.pop(); sv(LK,log); }catch(e){}
      return d;
    };
    BTX_AI.decide.__lg=1;
  }
  function hookOpen(){
    if(typeof window.openPos!=='function'||window.openPos.__pn) return;
    var o=window.openPos;
    window.openPos=function(g){
      var r=o(g);
      try{ var p=window.ST&&ST.pos&&ST.pos[g.sym]; if(p){ p.setup=g.why; p.mkt=g.mkt||'US'; p.aiConf=(g.ai&&g.ai.conf)!=null?g.ai.conf:null; } }catch(e){}
      return r;
    };
    window.openPos.__pn=1;
  }
  function hookClose(){
    if(typeof window.closePos!=='function'||window.closePos.__pn) return;
    var o=window.closePos;
    window.closePos=function(sym,why,px){
      var p=null; try{ p=window.ST&&ST.pos&&ST.pos[sym]; }catch(e){}
      var r=o(sym,why,px);
      try{
        var c=window.ST&&ST.closed&&ST.closed[0];
        if(c&&c.sym===sym){
          var mk='mkt:'+((p&&p.mkt)||'US');
          var st='setup:'+String((p&&p.setup)||'?').slice(0,42);
          [mk,st].forEach(function(k){
            var s=perf[k]||{w:0,l:0,cs:0,cn:0};
            if(c.pnl>0)s.w++; else s.l++;
            if(p&&p.aiConf!=null){ s.cs+=p.aiConf; s.cn++; }
            perf[k]=s;
          });
          sv(PK,perf);
        }
      }catch(e){}
      return r;
    };
    window.closePos.__pn=1;
  }
  function render(){
    var box=document.getElementById('ai-panel'); if(!box) return;
    var rows=log.slice(0,15).map(function(x){ var d=new Date(x.t); return [d.toLocaleTimeString('pl-PL'), x.mkt||'-', x.side||'-', (x.conf!=null?(x.conf*100).toFixed(0)+'%':'-'), (x.ok?'TAK':'NIE'), String(x.reason||'-')]; });
    var pr=Object.keys(perf).map(function(k){ var s=perf[k]; var n=s.w+s.l; var wr=n?Math.round(s.w/n*100):0; var ac=s.cn?((s.cs/s.cn)*100).toFixed(0)+'%':'-'; return [k,s.w,s.l,wr+'%',ac]; });
    var t1=rows.length?window.tbl(['Czas','Rynek','Strona','Pewnosc','OK','Powod'],rows):'<div class="mut">Brak decyzji - wykonaj cykl.</div>';
    var t2=pr.length?window.tbl(['Grupa','W','L','Win rate','Sr. pewnosc'],pr):'<div class="mut">Brak zamknietych transakcji.</div>';
    box.innerHTML='<div style="font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:var(--tx3);margin-bottom:8px">Ostatnie decyzje AI</div>'+t1+'<div style="font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:var(--tx3);margin:14px 0 8px">Skutecznosc modelu</div>'+t2;
  }
  function boot(){
    var pane=document.getElementById('pane-ai');
    if(pane&&!document.getElementById('ai-panel')){
      var c=document.createElement('div'); c.className='card'; c.style.marginTop='12px';
      c.innerHTML='<h2><span class="dot"></span>Dziennik AI i skutecznosc</h2><div id="ai-panel" class="mut">Ladowanie...</div>';
      pane.appendChild(c);
    }
    hookDecide(); hookOpen(); hookClose(); render();
    setInterval(function(){ hookDecide(); hookOpen(); hookClose(); render(); },1500);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();