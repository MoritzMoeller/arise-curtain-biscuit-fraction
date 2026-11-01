(function () {
  const C = window.CONFIG;
  const code = (new URLSearchParams(location.search).get("g") || "").trim();
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const lines = (s) => esc(s).replace(/\n/g, "<br>");
  const deck = $("#deck");
  const dots = $("#dots");

  // ---------- illustrations (drawn in code) ----------
  function rng(seed) {
    return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  }
  function meadowSVG(seed, w = 400, h = 150) {
    const r = rng(seed);
    const greens = ["#6d7a3a", "#8a9a48", "#55652e", "#a3ad5a"];
    let s = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">`;
    s += `<path d="M0 ${h * 0.55} Q ${w * 0.3} ${h * 0.42} ${w * 0.55} ${h * 0.52} T ${w} ${h * 0.48} V ${h} H 0 Z" fill="#a3ad5a" opacity=".55"/>`;
    for (let i = 0; i < 140; i++) {
      const x = r() * w, len = 25 + r() * 55, bend = (r() - 0.5) * 30;
      s += `<path d="M${x} ${h} q ${bend / 2} ${-len / 2} ${bend} ${-len}" stroke="${greens[i % 4]}" stroke-width="${1 + r() * 1.6}" fill="none" stroke-linecap="round"/>`;
    }
    for (let i = 0; i < 26; i++) {
      const x = 8 + r() * (w - 16), y = h * 0.35 + r() * h * 0.5, t = r();
      s += `<path d="M${x} ${h} Q ${x + (r() - 0.5) * 12} ${(y + h) / 2} ${x} ${y}" stroke="#55652e" stroke-width="1.4" fill="none"/>`;
      if (t < 0.32) s += daisy(x, y, 5 + r() * 3);
      else if (t < 0.55) s += poppy(x, y, 6 + r() * 4);
      else if (t < 0.8) s += cornflower(x, y, 4 + r() * 2);
      else s += `<circle cx="${x}" cy="${y}" r="${2.5 + r() * 1.5}" fill="#d8a624"/>`;
    }
    return s + "</svg>";
  }
  function daisy(x, y, rad) {
    let p = "";
    for (let a = 0; a < 360; a += 40)
      p += `<ellipse cx="${x}" cy="${y - rad * 0.7}" rx="${rad * 0.32}" ry="${rad * 0.7}" fill="#fffaf0" transform="rotate(${a} ${x} ${y})"/>`;
    return p + `<circle cx="${x}" cy="${y}" r="${rad * 0.35}" fill="#d8a624"/>`;
  }
  function poppy(x, y, rad) {
    return `<circle cx="${x - rad * 0.3}" cy="${y}" r="${rad * 0.75}" fill="#c13522"/>
            <circle cx="${x + rad * 0.3}" cy="${y - rad * 0.1}" r="${rad * 0.75}" fill="#d2412b"/>
            <circle cx="${x}" cy="${y}" r="${rad * 0.22}" fill="#2b2622"/>`;
  }
  function cornflower(x, y, rad) {
    let p = "";
    for (let a = 0; a < 360; a += 45)
      p += `<path d="M${x} ${y} l ${-rad * 0.3} ${-rad} h ${rad * 0.6} z" fill="#4a7fc1" transform="rotate(${a} ${x} ${y})"/>`;
    return p + `<circle cx="${x}" cy="${y}" r="${rad * 0.25}" fill="#2a4f86"/>`;
  }
  const mountainsSVG = `<svg viewBox="0 0 400 170" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">
    <path d="M0 170 V120 L40 95 L70 110 L95 60 L108 30 L122 55 L130 40 L150 100 L170 95 L190 18 L212 10 L232 70 L250 90 L268 30 L285 20 L300 75 L320 95 L345 70 L370 90 L400 85 V170 Z" fill="#8e7f8c" opacity=".75"/>
    <path d="M108 30 L100 75 L95 60 Z M190 18 L182 80 L172 95 Z M268 30 L262 85 L250 90 Z" fill="#e2a36a" opacity=".85"/>
    <path d="M0 170 V140 Q 120 112 230 130 T 400 120 V170 Z" fill="#c9cf8a" opacity=".6"/>
  </svg>`;
  $$(".meadow").forEach((el) => (el.innerHTML = meadowSVG(7)));
  $$(".mountains").forEach((el) => (el.innerHTML = mountainsSVG));

  // ---------- backend: Apps Script, or built-in demo data ----------
  const api = C.scriptUrl
    ? {
        async load(code) {
          const res = await fetch(`${C.scriptUrl}?code=${encodeURIComponent(code)}`);
          return res.json(); // { guest, rsvp, content, settings }
        },
        async save(code, rsvp) {
          // text/plain avoids a CORS preflight, which Apps Script can't answer
          const res = await fetch(C.scriptUrl, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ code, rsvp }) });
          return res.json(); // { ok, rsvp }
        },
      }
    : {
        async load(code) {
          const guest = C.demo.guests[code] || null;
          if (!guest) return { guest: null };
          let rsvp = null;
          try { rsvp = JSON.parse(localStorage.getItem("rsvp-" + code)); } catch {}
          return { guest, rsvp, content: C.demo.content, settings: C.demo.settings };
        },
        async save(code, rsvp) {
          await new Promise((r) => setTimeout(r, 400));
          try { localStorage.setItem("rsvp-" + code, JSON.stringify(rsvp)); } catch {}
          return { ok: true, rsvp };
        },
      };

  // ---------- build the pages from content rows: [page, type, text, extra] ----------
  // types: anrede · name · titel · text · zeit (time, what) · link (label, url) · antwort (the form)
  function renderBlock([, type, text, extra], guest) {
    switch (type) {
      case "anrede": return `<p>${esc(guest.greeting)},</p>`;
      case "name":   return `<h1>${esc(text).replace(/\s*&amp;\s*/, `<br><span class="amp">&amp;</span> `)}</h1>`;
      case "titel":  return `<h2>${esc(text)}</h2>`;
      case "text":   return `<p>${lines(text)}</p>`;
      case "zeit":   return `<li><time>${esc(text)}</time><span>${lines(extra)}</span></li>`;
      case "link":   return /^https?:\/\//.test(extra) ? `<p><a class="link" href="${esc(extra)}" target="_blank" rel="noopener">${esc(text)}</a></p>` : "";
      case "antwort": return `<div id="rsvp"></div>`;
      default: return "";
    }
  }

  function renderPages(content, guest) {
    const pages = new Map();
    for (const row of content) {
      const n = Number(row[0]);
      if (!n) continue;
      if (!pages.has(n)) pages.set(n, []);
      pages.get(n).push(row);
    }
    const order = [...pages.keys()].sort((a, b) => a - b);
    order.forEach((n, i) => {
      // wrap consecutive "zeit" rows into one timeline list
      let html = "", inList = false;
      for (const row of pages.get(n)) {
        const isTime = row[1] === "zeit";
        if (isTime && !inList) html += `<ol class="timeline">`;
        if (!isTime && inList) html += `</ol>`;
        inList = isTime;
        html += renderBlock(row, guest);
      }
      if (inList) html += `</ol>`;

      if (i === 0) {
        $("#cover").innerHTML = html;
      } else {
        const sec = document.createElement("section");
        sec.className = "screen";
        sec.id = "s" + (i + 1);
        sec.innerHTML = `<div class="inner">${html}</div>`;
        deck.appendChild(sec);
      }
    });
    $(".cover").id = "s1";
  }

  // ---------- swiping & dots ----------
  const current = () => Math.round(deck.scrollLeft / deck.clientWidth);
  const go = (i) => deck.scrollTo({ left: i * deck.clientWidth, behavior: "smooth" });
  const updateDots = () => $$("button", dots).forEach((b, j) => b.setAttribute("aria-current", current() === j));
  function setupNav() {
    $$(".screen").forEach((_, i) => {
      const b = document.createElement("button");
      b.setAttribute("aria-label", `Seite ${i + 1}`);
      b.onclick = () => go(i);
      dots.appendChild(b);
    });
    deck.addEventListener("scroll", () => requestAnimationFrame(updateDots));
    document.addEventListener("keydown", (e) => {
      if (e.target.closest("input")) return;
      if (e.key === "ArrowRight") go(current() + 1);
      if (e.key === "ArrowLeft") go(current() - 1);
    });
    // deep links like …/?g=abc#s4 jump straight to that page
    const target = location.hash && document.getElementById(location.hash.slice(1));
    if (target) deck.scrollLeft = $$(".screen").indexOf(target) * deck.clientWidth;
    updateDots();
  }

  // ---------- answer form ----------
  function setupRsvp(box, guest, rsvp, S) {
    const options = String(S.options || "").split(",").map((s) => s.trim()).filter(Boolean);

    function showSummary(r) {
      const anyone = r.people.some((p) => p.choices.some(Boolean));
      const items = r.people
        .map((p) => {
          const picked = options.filter((_, j) => p.choices[j]);
          return `<li><strong>${esc(p.name)}</strong><br><span class="soft">${esc(picked.length ? picked.join(" · ") : S.noneLabel || "–")}</span></li>`;
        })
        .join("");
      box.innerHTML = `
        <h2>${esc(anyone ? S.thanksYes : S.thanksNo)}</h2>
        <ul class="answers">${items}</ul>
        ${r.diet ? `<p>${esc(S.dietLabel || "")}: ${esc(r.diet)}</p>` : ""}
        <p class="soft">${lines(S.lockedNote)}</p>`;
    }

    if (rsvp) return showSummary(rsvp);

    const people = guest.people
      .map((name, i) => `<div class="person">
          <div class="person-name">${esc(name)}</div>
          ${options.map((o, j) => `<label class="check"><input type="checkbox" name="c-${i}-${j}" ${j === 0 ? "checked" : ""}> ${esc(o)}</label>`).join("")}
        </div>`)
      .join("");
    const diet = S.dietLabel
      ? `<label class="field"><span>${esc(S.dietLabel)}</span><input name="diet" placeholder="${esc(S.dietPlaceholder)}"></label>`
      : "";
    box.innerHTML = `<form>${people}${diet}
        <button type="submit" class="btn">${esc(S.submit || "Absenden")}</button>
        <p class="status">${esc(S.submitNote)}</p></form>`;

    const form = $("form", box);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const r = {
        people: guest.people.map((name, i) => ({ name, choices: options.map((_, j) => form[`c-${i}-${j}`].checked) })),
        diet: form.diet ? form.diet.value.trim() : "",
        savedAt: new Date().toISOString(),
      };
      const btn = $("button", form);
      const status = $(".status", form);
      btn.disabled = true;
      status.textContent = "…";
      try {
        const res = await api.save(code, r);
        if (!res.rsvp) throw new Error(res.error);
        showSummary(res.rsvp); // if there already was an answer, this shows the stored one
      } catch {
        status.textContent = "Das hat leider nicht geklappt – bitte nochmal versuchen.";
        btn.disabled = false;
      }
    });
  }

  // ---------- start: nothing is shown without a valid code ----------
  const setState = (s) => (document.body.dataset.state = s);
  (async () => {
    if (!code) return setState("nolink");
    let data;
    try {
      data = await api.load(code);
    } catch {
      $(".gate").textContent = "Konnte nicht geladen werden. Bitte später nochmal versuchen.";
      return setState("nolink");
    }
    if (!data.guest) return setState("nolink");
    const S = data.settings || {};
    if (S.title) document.title = S.title;
    renderPages(data.content || [], data.guest);
    const box = $("#rsvp");
    if (box) setupRsvp(box, data.guest, data.rsvp, S);
    setState("ready");
    setupNav();
  })();
})();
