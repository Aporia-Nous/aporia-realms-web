(function(){const i=document.createElement("link").relList;if(i&&i.supports&&i.supports("modulepreload"))return;for(const e of document.querySelectorAll('link[rel="modulepreload"]'))r(e);new MutationObserver(e=>{for(const a of e)if(a.type==="childList")for(const d of a.addedNodes)d.tagName==="LINK"&&d.rel==="modulepreload"&&r(d)}).observe(document,{childList:!0,subtree:!0});function s(e){const a={};return e.integrity&&(a.integrity=e.integrity),e.referrerPolicy&&(a.referrerPolicy=e.referrerPolicy),e.crossOrigin==="use-credentials"?a.credentials="include":e.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function r(e){if(e.ep)return;e.ep=!0;const a=s(e);fetch(e.href,a)}})();const u="https://api.aporiarealms.com",h=document.querySelector("#app");let c=null,n=null,l=null,v=[],y=!0,f=null;const o=(t="")=>String(t).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");function E(t=""){return t.split(/\s+/).filter(Boolean).slice(0,2).map(i=>i[0]).join("").toUpperCase()||"•"}function L(){return!v||v.length===0?'<div style="color: var(--muted); text-align: center; padding: 40px;">The world awaits your action.</div>':v.map(t=>{const i=t.type==="player",s=t.type==="narration"||!t.speaker&&!i,r=t.speaker||(i?"You":"Narrator");return`
      <article class="story-entry ${i?"player-entry":s?"narration":"dialogue"}">
        <div class="speaker-row">
          <div class="avatar ${i?"player-avatar":""}">${o(E(r))}</div>
          <strong>${o(r)}</strong>
        </div>
        <div class="story-text">${o(t.text||"")}</div>
      </article>
    `}).join("")}function g(){var a,d,p,$,x,w,A,k;if(!c){S();return}const t=(l==null?void 0:l.name)||"Aethelgard",i=(l==null?void 0:l.role)||"Paladin",s=((a=l==null?void 0:l.hp)==null?void 0:a.current)||24,r=((d=l==null?void 0:l.hp)==null?void 0:d.max)||24,e=Math.max(0,Math.min(100,s/r*100));h.innerHTML=`
    <div class="world-shell">
      <aside class="left-rail">
        <div class="brand-block">
          <div class="brand-mark">AR</div>
          <div>
            <strong>Aporia Realms</strong>
            <span>${o(c.worldId||"Solis Grave")}</span>
          </div>
        </div>

        <nav class="main-nav" aria-label="Main navigation">
          <button class="nav-link active">Adventure</button>
          <button class="nav-link" id="viewJournal">Journal</button>
          <button class="nav-link" id="leaveWorld">Worlds</button>
        </nav>

        <div class="rail-label">Your party</div>
        <div class="party-list">
          <div class="party-card">
            <div class="party-avatar">${o(E(t))}</div>
            <div class="party-info">
              <strong>${o(t)}</strong>
              <span>${o(i)} (Level ${(l==null?void 0:l.level)||4})</span>
              <div class="hp"><span style="width:${e}%"></span></div>
            </div>
          </div>
        </div>

        <div class="rail-bottom">
          <span class="live-dot"></span>
          <span>Engine Active (${u.replace("https://","")})</span>
        </div>
      </aside>

      <main class="story-panel">
        <header class="story-header">
          <div>
            <span class="chapter-label">Aporia Realms • Live</span>
            <h1>${o(((p=n==null?void 0:n.location)==null?void 0:p.name)||"The Citadel Border")}</h1>
            <p>${o((($=n==null?void 0:n.location)==null?void 0:$.region)||"Dark Fantasy Blight")} • ${o(((x=n==null?void 0:n.location)==null?void 0:x.time)||"Dusk")}</p>
          </div>
          <button id="readAloud" class="sound-toggle ${y?"on":""}" aria-pressed="${y}">
            ${y?"🔊 Read aloud":"🔇 Voice off"}
          </button>
        </header>

        <section class="scene-card">
          <div class="scene-copy">
            <span class="scene-kicker">Atmosphere</span>
            <h2>${o(((w=n==null?void 0:n.location)==null?void 0:w.name)||"Border Crossing")}</h2>
            <p>${o(((A=n==null?void 0:n.location)==null?void 0:A.text)||"Muddy border barricade manned by garrison watch.")}</p>
          </div>
          <div class="atmosphere">
            <span>Weather: ${o(((k=n==null?void 0:n.location)==null?void 0:k.weather)||"Cold rain")}</span>
            <span>Mode: ${o(c.mode||"Adventure")}</span>
          </div>
        </section>

        <section class="story-feed">${L()}</section>

        <div class="action-box">
          <textarea id="intent" placeholder="What do you do or say?" aria-label="What do you do or say?"></textarea>
          <div class="action-footer">
            <span id="engineStatus">Actions and dice rolls resolve authoritatively in the engine.</span>
            <button id="sendIntent" class="continue-btn">Continue</button>
          </div>
        </div>
      </main>

      <aside class="settings-panel">
        <div class="settings-head">
          <span>Active World</span>
          <small>${o(c.id)}</small>
        </div>

        <div class="setting-group">
          <label>Present Characters</label>
          <div style="font-size: 11px; line-height: 1.6; color: var(--text);">
            ${((n==null?void 0:n.present)||[]).map(m=>`<div><strong>${o(m.name)}</strong><br><span style="color:var(--muted);">${o(m.role)}</span></div>`).join('<hr style="border:0;border-top:1px solid var(--line);margin:6px 0;">')||'<span style="color:var(--muted);">No one in immediate view</span>'}
          </div>
        </div>

        <div class="setting-group">
          <label>Action Suggestions</label>
          <div style="display: grid; gap: 6px;">
            ${((n==null?void 0:n.suggestions)||[]).map(m=>`<button class="suggestion-btn" data-intent="${o(m)}">${o(m)}</button>`).join("")}
          </div>
        </div>

        <div class="tip-card">
          <strong>Authoritative Rules</strong>
          <p>The rules engine resolves combat math, skills, and conditions before the narrator describes the committed reality.</p>
        </div>
      </aside>
    </div>
  `,P()}function S(){var t;h.innerHTML=`
    <div class="boot-card" style="max-width: 580px;">
      <div class="brand-block" style="justify-content: center; margin-bottom: 14px;">
        <div class="brand-mark">AR</div>
      </div>
      <h2 style="text-align: center; margin-bottom: 4px;">Aporia Realms</h2>
      <p style="text-align: center; color: var(--muted); margin-bottom: 24px;">Select a living world to enter.</p>

      <div style="border: 1px solid var(--line); border-radius: 16px; padding: 18px; background: rgba(255,255,255,0.02); margin-bottom: 20px;">
        <h3 style="margin: 0 0 6px 0;">Solis Grave</h3>
        <p style="font-size: 12px; color: var(--muted); line-height: 1.5; margin: 0 0 14px 0;">
          A dark fantasy world gripped by the Sovereign Blight. Full D&D 5e mechanics, unyielding continuity, and authoritative local voice.
        </p>
        <div style="display: flex; gap: 10px;">
          <button id="btnEnterSolis" class="continue-btn" style="flex: 1; padding: 12px;">Enter Solis Grave</button>
        </div>
      </div>
    </div>
  `,(t=document.querySelector("#btnEnterSolis"))==null||t.addEventListener("click",T)}async function T(){h.innerHTML='<div class="boot-card"><p>Entering Solis Grave…</p></div>';try{const t=await fetch(`${u}/campaigns`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({worldId:"solis-grave",mode:"adventure",characterName:"Aethelgard"})});if(!t.ok)throw new Error(`HTTP ${t.status}`);c=await t.json();const[i,s]=await Promise.all([fetch(`${u}/campaigns/${c.id}/scene`),fetch(`${u}/campaigns/${c.id}/character`)]);n=await i.json(),l=await s.json(),v=n.feed||[],g()}catch(t){h.innerHTML=`<div class="boot-card"><h3>Failed to enter world</h3><p>${o(t.message)}</p><button class="continue-btn" onclick="location.reload()">Retry</button></div>`}}async function b(t){if(!t||!c)return;const i=document.querySelector("#sendIntent"),s=document.querySelector("#intent"),r=document.querySelector("#engineStatus");i&&(i.disabled=!0),s&&(s.disabled=!0),r&&(r.textContent="Resolving intent through World Engine…"),v.push({type:"player",text:t,speaker:"You"}),g();try{const e=await fetch(`${u}/campaigns/${c.id}/intents`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:t})});if(!e.ok)throw new Error(`HTTP ${e.status}`);const a=await e.json();if(a.entries&&v.push(...a.entries),a.scene&&(n={...n,...a.scene}),g(),y&&a.entries&&a.entries.length>0){const d=a.entries.filter(p=>p.type==="dialogue"||p.type==="narration");for(const p of d)await R(p.text,p.speaker)}}catch(e){r&&(r.textContent=`Engine error: ${e.message}`)}finally{i&&(i.disabled=!1),s&&(s.disabled=!1,s.value="",s.focus()),r&&(r.textContent="Write naturally. You can speak, act, inspect, or try anything.")}}async function R(t,i="NARRATOR"){if(!(!t||!c))try{const s=await fetch(`${u}/api/voice/speak`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({campaignId:c.id,text:t,speaker:i})});if(!s.ok)return;const r=await s.blob(),e=URL.createObjectURL(r);f&&f.pause(),f=new Audio(e),await f.play()}catch(s){console.warn("Speech playback failed",s)}}function P(){var t,i,s,r;(t=document.querySelector("#readAloud"))==null||t.addEventListener("click",()=>{y=!y,g()}),(i=document.querySelector("#sendIntent"))==null||i.addEventListener("click",()=>{var a,d;const e=(d=(a=document.querySelector("#intent"))==null?void 0:a.value)==null?void 0:d.trim();e&&b(e)}),(s=document.querySelector("#intent"))==null||s.addEventListener("keydown",e=>{var a;if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();const d=(a=e.target.value)==null?void 0:a.trim();d&&b(d)}}),document.querySelectorAll(".suggestion-btn").forEach(e=>{e.addEventListener("click",()=>{const a=e.getAttribute("data-intent");a&&b(a)})}),(r=document.querySelector("#leaveWorld"))==null||r.addEventListener("click",()=>{c=null,g()})}g();
