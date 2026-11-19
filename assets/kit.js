/* =====================================================================
   Moteur du kit — NE PAS MODIFIER
   Lit :  menu.txt                                → réglages + liste des rubriques
          rubriques/<Rubrique>/config.txt         → introduction, page, blocs, documents
          rubriques/<Rubrique>/<Bloc>/config.txt  → fiche du bloc
          rubriques/<Rubrique>/<Bloc>/logo.png    → logo du bloc (png, jpg, svg, webp)
   Fonctionne sur tout hébergement web, sans PHP.
   ===================================================================== */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var LOGOS = ["logo.png", "logo.jpg", "logo.svg", "logo.webp"];
  var S = { reglages: {}, rubriques: [], blocs: [] };

  /* ---------- utilitaires ---------- */
  function norm(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function cle(s) { return norm(s).replace(/[^a-z0-9]/g, ""); }
  function slug(s) { return norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function trier(a, b) { return String(a).localeCompare(String(b), "fr", { numeric: true, sensitivity: "base" }); }
  function chemin(rel) { return rel.split("/").map(encodeURIComponent).join("/"); }
  function lien(base, cible) { return /^(https?:|mailto:|tel:)/i.test(cible) ? cible : chemin(base + cible.replace(/^\.?\//, "")); }

  function lireTexte(rel) {
    return fetch(chemin(rel), { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("introuvable");
      return r.arrayBuffer();
    }).then(function (b) {
      try { return new TextDecoder("utf-8", { fatal: true }).decode(b); }
      catch (e) { return new TextDecoder("windows-1252").decode(b); }
    });
  }

  /* ---------- format des fichiers de config ----------
     Clé : valeur           (les lignes suivantes sans "Clé :" prolongent la valeur)
     [Section]              puis une ligne par élément
     # commentaire                                                        */
  function parseConfig(texte) {
    var cfg = { paires: [], cles: {}, listes: {} }, section = null, dernier = null;
    String(texte || "").replace(/^﻿/, "").split(/\r?\n/).forEach(function (l) {
      var t = l.trim();
      if (!t || t.charAt(0) === "#") return;
      var sec = t.match(/^\[(.+)\]$/);
      if (sec) { section = cle(sec[1]); cfg.listes[section] = []; dernier = null; return; }
      if (section) { cfg.listes[section].push(t.replace(/^[-*•]\s+/, "")); return; }
      var m = t.match(/^([^:=]{1,40}?)\s*[:=]\s?(.*)$/);
      if (m && !/^https?$/i.test(m[1]) && !/\/\//.test(m[1])) { dernier = [m[1].trim(), m[2].trim()]; cfg.paires.push(dernier); cfg.cles[cle(m[1])] = dernier; }
      else if (dernier) dernier[1] += (dernier[1] ? "\n" : "") + t;
    });
    cfg.val = function () { for (var i = 0; i < arguments.length; i++) { var p = cfg.cles[cle(arguments[i])]; if (p && p[1]) return p[1]; } return ""; };
    return cfg;
  }
  var ALIAS = {
    nom: "nom", titre: "nom", structure: "nom",
    statut: "statut", statutjuridique: "statut", formejuridique: "statut",
    departement: "departement", dept: "departement",
    ville: "ville", commune: "ville", adresse: "adresse",
    contact: "contact", referent: "contact", referente: "contact", responsable: "contact",
    telephone: "telephone", tel: "telephone",
    email: "email", mail: "email", courriel: "email",
    site: "site", siteweb: "site", siteinternet: "site", lien: "site",
    description: "description", texte: "description", presentation: "description",
    logo: "logo", document: "document", type: "type",
    emetteur: "emetteur", financeur: "emetteur", organisme: "emetteur"
  };

  /* ---------- chargement ---------- */
  function chargerBloc(rub, nom) {
    var base = "rubriques/" + rub.dossier + "/" + nom + "/";
    return lireTexte(base + "config.txt").then(parseConfig, function () { return null; }).then(function (cfg) {
      var b = { autres: [], dossier: nom, rubrique: rub.titre, base: base, erreur: !cfg };
      (cfg ? cfg.paires : []).forEach(function (p) { var k = ALIAS[cle(p[0])]; if (k) b[k] = p[1]; else if (p[1]) b.autres.push(p); });
      b.nom = b.nom || nom;
      b.logos = b.logo ? (/^aucun$/i.test(b.logo) ? [] : [lien(base, b.logo)]) : LOGOS.map(function (f) { return lien(base, f); });
      return b;
    });
  }
  function chargerRubrique(nom) {
    var rub = { dossier: nom, titre: nom, base: "rubriques/" + nom + "/", blocs: [], documents: [], intro: "", page: "", erreur: false };
    return lireTexte(rub.base + "config.txt").then(parseConfig, function () { rub.erreur = true; return parseConfig(""); }).then(function (cfg) {
      rub.titre = cfg.val("Titre") || nom;
      rub.intro = cfg.val("Introduction", "Intro", "Description");
      rub.titreBlocs = cfg.val("Titre des blocs");
      rub.titreDocs = cfg.val("Titre des documents");
      rub.cfg = cfg;
      rub.filtres = (cfg.val("Filtres", "Filtre") || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean);
      rub.pageDeclaree = !!cfg.val("Page");
      rub.page = cfg.val("Page") || "page.html";
      rub.carte = cfg.val("Carte", "Intégration", "Integration");
      rub.hauteurCarte = parseInt(cfg.val("Hauteur de la carte", "Hauteur carte"), 10) || 480;
      // [Documents] : une ligne par document ; « Catégorie : Nom » ouvre une sous-catégorie
      rub.documents = []; rub.categories = [];
      var cat = "";
      (cfg.listes.documents || []).forEach(function (d) {
        var c = d.match(/^cat[ée]gorie\s*:\s*(.+)$/i);
        if (c) { cat = c[1].trim(); if (rub.categories.indexOf(cat) < 0) rub.categories.push(cat); return; }
        var p = d.split("|"), cible = (p[1] || p[0]).trim(), lib = p[1] ? p[0].trim() : "";
        rub.documents.push({ libelle: lib, fichier: cible, url: lien(rub.base, cible), categorie: cat });
      });
      return Promise.all((cfg.listes.blocs || []).map(function (b) { return chargerBloc(rub, b); }));
    }).then(function (blocs) { rub.blocs = blocs; return rub; });
  }
  function charger() {
    return lireTexte("menu.txt").then(parseConfig).then(function (cfg) {
      S.reglages = {
        titre: cfg.val("Titre") || "Kit", soustitre: cfg.val("Sous-titre"),
        accueil: cfg.val("Message d'accueil", "Accueil"), couleur: cfg.val("Couleur"),
        logo: cfg.val("Logo")
      };
      S.infos = [];
      Object.keys(cfg.listes).forEach(function (k) { if (/^derni/.test(k)) S.infos = cfg.listes[k]; });
      return Promise.all((cfg.listes.menu || []).map(chargerRubrique));
    }).then(function (rubs) {
      S.rubriques = rubs;
      S.blocs = [];
      rubs.forEach(function (r) { S.blocs = S.blocs.concat(r.blocs.filter(function (b) { return !b.erreur; })); });
    });
  }

  /* ---------- logos : essaie logo.png, logo.jpg… puis initiale ---------- */
  window.__kitLogo = function (img) {
    var l = (img.getAttribute("data-suivants") || "").split("\n").filter(Boolean);
    if (l.length) { img.setAttribute("data-suivants", l.slice(1).join("\n")); img.src = l[0]; }
    else img.remove();
  };
  window.__kitLogoOk = function (img) {
    img.style.display = "";
    var v = img.parentNode && img.parentNode.querySelector(".logo-vide"); if (v) v.remove();
  };
  function logoHtml(b) {
    var court = String(b.emetteur || b.nom).trim().replace(/^(maisons?\s+sport[-\s]?sant[ée]|mss)\s*/i, "").replace(/^(de\s+la|de\s+l['’]|d['’]|l['’]|du|des|de|en|la|le|les)\s*/i, "");
    var ini = esc((court || String(b.nom).trim()).charAt(0).toUpperCase());
    var vide = '<div class="logo logo-vide">' + ini + "</div>";
    if (!b.logos.length) return vide;
    return '<span class="logo-box">' + vide + '<img class="logo" alt="" style="display:none" src="' + esc(b.logos[0]) + '" data-suivants="' + esc(b.logos.slice(1).join("\n")) + '" onload="__kitLogoOk(this)" onerror="__kitLogo(this)"></span>';
  }

  /* ---------- carte d'un bloc ---------- */
  function surligner(text, q) {
    var t = esc(text), mots = (Array.isArray(q) ? q : [q]).filter(Boolean); if (!mots.length) return t;
    var n = norm(t), iv = [];
    mots.forEach(function (w) { var i = 0, idx; while ((idx = n.indexOf(w, i)) >= 0) { iv.push([idx, idx + w.length]); i = idx + w.length; } });
    if (!iv.length) return t;
    iv.sort(function (a, b) { return a[0] - b[0]; });
    var m = [iv[0]]; iv.slice(1).forEach(function (x) { var d = m[m.length - 1]; if (x[0] <= d[1]) d[1] = Math.max(d[1], x[1]); else m.push(x); });
    var out = "", i = 0;
    m.forEach(function (x) { if (t.slice(i, x[1]).indexOf("&") >= 0 && /&[a-z#0-9]*$/i.test(t.slice(i, x[0]))) return; out += t.slice(i, x[0]) + "<mark>" + t.slice(x[0], x[1]) + "</mark>"; i = x[1]; });
    return out + t.slice(i);
  }
  function valeursChamp(b, nom) {
    var k = ALIAS[cle(nom)], v = k ? b[k] : valeurAutre(b, nom);
    return String(v || "").split(/\s*[,;\/]\s*|\s+et\s+/).map(function (x) { return x.trim(); }).filter(Boolean);
  }
  function carte(b, q, avecRubrique, champsBadges) {
    champsBadges = champsBadges || [];
    if (b.erreur) return '<article class="card card-erreur"><h3>⚠️ ' + esc(b.dossier) + '</h3><p>Fichier <code>config.txt</code> introuvable dans le dossier <b>' + esc(b.base) + "</b>. Vérifiez que le nom du dossier correspond exactement à la ligne du fichier de la rubrique.</p></article>";
    var l = [];
    if (b.ville || b.adresse) l.push("📍 " + esc([b.adresse, b.ville].filter(Boolean).join(", ")));
    if (b.contact) l.push("👤 " + esc(b.contact));
    if (b.telephone) l.push("📞 " + esc(b.telephone).replace(/(?:\+33\s?|0)[1-9](?:[\s.]?\d{2}){4}/g, function (t) { return '<a href="tel:' + t.replace(/[\s.]/g, "") + '">' + t + "</a>"; }));
    if (b.email) l.push("✉️ " + String(b.email).split(/[;,\s]+/).filter(function (e) { return e.indexOf("@") > 0; }).map(function (e) { return '<a href="mailto:' + esc(e) + '">' + esc(e) + "</a>"; }).join(", "));
    if (b.site) l.push('🌐 <a href="' + esc(/^https?:/i.test(b.site) ? b.site : "https://" + b.site) + '" target="_blank" rel="noopener">' + esc(String(b.site).replace(/^https?:\/\//, "")) + "</a>");
    if (b.document) l.push('📄 <a href="' + esc(lien(b.base, b.document)) + '" target="_blank">' + esc(b.document.split("/").pop()) + "</a>");
    var x = b.autres.filter(function (a) { return cle(a[0]) !== "carte" && cle(a[0]) !== "livret" && !champsBadges.some(function (c) { return cle(c) === cle(a[0]); }); }).map(function (a) { return "<b>" + esc(a[0]) + "</b> : " + liens(esc(a[1])).replace(/\n/g, "<br>"); });
    return '<article class="card"><div class="card-head">' + logoHtml(b) + "<div><h3>" + surligner(b.nom, q) + '</h3><div class="badges">' +
      (avecRubrique ? '<span class="badge type">' + esc(b.type || b.rubrique) + "</span>" : "") +
      champsBadges.map(function (c) { return valeursChamp(b, c).map(function (v) { return '<span class="badge filtre">' + esc(v) + "</span>"; }).join(""); }).join("") +
      (b.emetteur ? '<span class="badge emetteur">🏛️ ' + esc(b.emetteur) + "</span>" : "") +
      (b.statut ? '<span class="badge">' + esc(b.statut) + "</span>" : "") +
      (b.departement ? '<span class="badge">' + esc(b.departement) + "</span>" : "") +
      (pointsCarte(b) ? '<span class="badge carte-num">📍 n° ' + esc(pointsCarte(b).num) + " sur la carte</span>" : "") +
      "</div></div></div>" + (b.description ? "<p>" + surligner(b.description, q).replace(/\n/g, "<br>") + "</p>" : "") +
      (x.length ? '<div class="lines infos">' + x.join("<br>") + "</div>" : "") +
      (l.length ? '<div class="lines coords">' + l.join("<br>") + "</div>" : "") +
      (avecRubrique ? '<a class="voir" href="#/r/' + slug(b.rubrique) + '">Voir la rubrique « ' + esc(b.rubrique) + " » →</a>" : "") + "</article>";
  }
  function liens(t) { return t.replace(/https?:\/\/[^\s<]+[^\s<.,;)]/g, function (u) { return '<a href="' + u + '" target="_blank" rel="noopener">' + u.replace(/^https?:\/\//, "") + "</a>"; }); }
  function uniq(list, f) { var s = {}; list.forEach(function (d) { if (d[f]) s[String(d[f]).trim()] = 1; }); return Object.keys(s).sort(trier); }
  function texteBloc(b) { return norm([b.nom, b.emetteur, b.ville, b.adresse, b.contact, b.description, b.statut, b.departement, b.rubrique, b.type, b.email].concat(b._cats || [], b.autres.map(function (a) { return a[0] + " " + a[1]; })).join(" ")); }
  function filtrer(list, q, statut, dept, rub, emet, cat) {
    var mots = norm(q).split(/\s+/).filter(Boolean);
    return list.filter(function (b) {
      if (b.erreur) return !mots.length && !statut && !dept;
      if (statut && String(b.statut || "").trim() !== statut) return false;
      if (dept && String(b.departement || "").trim() !== dept) return false;
      if (rub && b.rubrique !== rub) return false;
      if (emet && String(b.emetteur || "").trim() !== emet) return false;
      if (cat && (b._cats || []).indexOf(cat) < 0) return false;
      if (!mots.length) return true;
      var hay = b._hay || (b._hay = texteBloc(b));
      return mots.every(function (w) { return hay.indexOf(w) >= 0; });
    });
  }
  /* pertinence : un mot trouvé dans le nom compte davantage */
  function score(b, mots) {
    var nom = norm(b.nom), sec = norm([b.emetteur, b.ville, b.departement, (b._cats || []).join(" ")].join(" ")), s = 0;
    mots.forEach(function (w) { if (nom.indexOf(w) === 0) s += 6; else if (nom.indexOf(w) >= 0) s += 4; if (sec.indexOf(w) >= 0) s += 2; });
    return s;
  }

  /* ---------- flash « Dernières informations » (section [Dernières informations] de menu.txt) ---------- */
  function afficherInfos() {
    var box = $("infos"); if (!box) return;
    var items = (S.infos || []).map(function (l) { return l.split("|").map(function (x) { return x.trim(); }); }).filter(function (p) { return p[0]; });
    if (!items.length) { box.hidden = true; return; }
    box.innerHTML = '<div class="infos-titre"><span class="infos-puce">⚡</span> Dernières informations</div><ul>' + items.map(function (p) {
      var u = p[1] || "", ext = /^(https?:|#|mailto:)/i.test(u), href = ext ? u : encodeURI(u);
      var nouv = /\.(docx?|pptx?|pdf|xlsx?)$/i.exec(u);
      return "<li>" + (p[2] ? '<span class="infos-date">' + esc(p[2]) + "</span>" : "") + (u ? '<a href="' + esc(href) + '"' + (u.charAt(0) === "#" ? "" : ' target="_blank" rel="noopener"') + ">" + esc(p[0]) + "</a>" : "<b>" + esc(p[0]) + "</b>") +
        (nouv ? ' <span class="infos-type">' + nouv[1].toUpperCase() + "</span>" : "") + (p[3] ? '<span class="infos-desc">' + esc(p[3]) + "</span>" : "") + "</li>";
    }).join("") + "</ul>";
    box.hidden = false;
  }

  /* ---------- menu & accueil ---------- */
  var ICONES = [[/livret/i, "📘"], [/identif/i, "🏷️"], [/r[ôo]le|pr[ée]sentation/i, "🧭"], [/habilit|proc[eé]dure/i, "📋"], [/r[eé]f[eé]renc/i, "🏷️"], [/liste|annuaire|collectif|mss/i, "📍"], [/partenaire/i, "🤝"], [/financ/i, "💶"], [/contact/i, "☎️"], [/formation/i, "🎓"], [/actu/i, "📰"], [/agenda|calendrier|[eé]v[eé]nement/i, "📅"], [/outil/i, "🧰"], [/document|ressource/i, "📂"], [/faq|question/i, "❓"], [/club/i, "🏃"]];
  function icone(n) { for (var i = 0; i < ICONES.length; i++) if (ICONES[i][0].test(n)) return ICONES[i][1]; return "📁"; }
  function construireMenu() {
    var h = '<a href="#/accueil" data-route="accueil"><span class="ico">🏠</span>Accueil</a>', t = "";
    S.rubriques.forEach(function (r) {
      var s = slug(r.titre);
      h += '<a href="#/r/' + s + '" data-route="r/' + s + '"><span class="ico">' + icone(r.titre) + "</span>" + esc(r.titre) + "</a>";
      t += '<a class="tile" href="#/r/' + s + '"><span class="ico">' + icone(r.titre) + '</span><span class="t">' + esc(r.titre) + "</span>" + (r.intro ? '<span class="d">' + esc(r.intro) + "</span>" : "") + "</a>";
    });
    h += '<div class="sep"></div><a href="#/recherche" data-route="recherche"><span class="ico">🔍</span>Rechercher</a>';
    t += '<a class="tile tile-search" href="#/recherche"><span class="ico">🔍</span><span class="t">Rechercher</span><span class="d">Fiches, pages et documents du kit : structures, financements, outils, formations… filtrables par rubrique, catégorie, département et statut.</span></a>';
    $("nav").innerHTML = h; $("tiles").innerHTML = t;
    var ok = function (r) { return r.blocs.filter(function (b) { return !b.erreur; }).length; };
    var avec = S.rubriques.filter(ok);
    $("stats").innerHTML = avec.map(function (r) { return '<a class="stat" href="#/r/' + slug(r.titre) + '"><b>' + ok(r) + "</b>" + esc(r.titre) + "</a>"; }).join("");
  }

  /* ---------- vue Rubrique ---------- */
  function afficherRubrique(r) {
    var h = '<div class="rub-head"><h2>' + esc(r.titre) + "</h2>" + (r.intro ? "<p>" + esc(r.intro).replace(/\n/g, "<br>") + "</p>" : "") + "</div>";
    if (r.erreur) h += '<div class="alerte">⚠️ Fichier <code>config.txt</code> introuvable dans <b>' + esc(r.base) + "</b>. Vérifiez que le dossier porte exactement le nom indiqué dans <code>menu.txt</code>.</div>";
    if (r.carte && /^https?:\/\//i.test(r.carte)) {
      h += '<div class="carte"><iframe src="' + esc(urlCarte(r.carte)) + '" style="height:' + r.hauteurCarte + 'px" loading="lazy" allowfullscreen title="Carte"></iframe>' +
        '<a class="carte-lien" href="' + esc(r.carte) + '" target="_blank" rel="noopener">⤢ Ouvrir la carte en plein écran</a></div>';
    }
    if (r.page) h += '<div class="contenu" id="rubPage"></div>';
    if (r.blocs.length) {
      h += r.titreBlocs ? "<h3 class=\"section\">" + esc(r.titreBlocs) + "</h3>" : "";
      var st = uniq(r.blocs, "statut"), dp = uniq(r.blocs, "departement"), em = uniq(r.blocs, "emetteur");
      var fx = r.filtres.map(function (f) { var s0 = {}; r.blocs.forEach(function (b) { valeursChamp(b, f).forEach(function (v) { s0[v] = 1; }); }); return { nom: f, vals: Object.keys(s0).sort(trier) }; });
      if (r.blocs.length > 3 || st.length > 1 || dp.length > 1 || em.length > 1 || r.filtres.length) {
        h += '<div class="rub-filtres"><input type="search" id="rq" placeholder="Filtrer…">' +
          fx.map(function (f, i) { return '<select id="rx' + i + '" data-champ="' + esc(f.nom) + '"><option value="">' + esc(f.nom) + " : tous</option>" + f.vals.map(function (x) { return "<option>" + esc(x) + "</option>"; }).join("") + "</select>"; }).join("") +
          (em.length > 1 ? '<select id="re"><option value="">Tous organismes</option>' + em.map(function (x) { return "<option>" + esc(x) + "</option>"; }).join("") + "</select>" : "") +
          (st.length > 1 ? '<select id="rs"><option value="">Tous statuts juridiques</option>' + st.map(function (x) { return "<option>" + esc(x) + "</option>"; }).join("") + "</select>" : "") +
          (dp.length > 1 ? '<select id="rd"><option value="">Tous départements</option>' + dp.map(function (x) { return "<option>" + esc(x) + "</option>"; }).join("") + "</select>" : "") + "</div>";
      }
      h += '<div class="result-count" id="rc"></div><div class="cards" id="rcards"></div>';
    }
    if (r.documents.length || r.categories.length) {
      h += '<h3 class="section">' + esc(r.titreDocs || "Documents") + "</h3>";
      groupesDocs(r).forEach(function (g) {
        if (g.nom) h += '<h4 class="groupe">' + iconeCategorie(g.nom) + " " + esc(g.nom) + "</h4>";
        h += g.docs.length ? '<ul class="docs">' + g.docs.map(docHtml).join("") + "</ul>" : '<p class="vide-cat">Aucun document pour le moment.</p>';
      });
    }
    if (!r.pageDeclaree && !r.carte && !r.blocs.length && !r.documents.length && !r.categories.length && !r.erreur) h += '<div class="empty">Cette rubrique est encore vide.</div>';
    $("viewRub").innerHTML = h;
    $("viewRub").scrollTop = 0;

    if (r.page) lireTexte(r.base + r.page).then(function (html) {
      var box = $("rubPage"); if (!box) return;
      var doc = new DOMParser().parseFromString(html, "text/html");
      doc.querySelectorAll("script").forEach(function (s) { s.remove(); });
      doc.querySelectorAll("[href],[src]").forEach(function (el) {
        ["href", "src"].forEach(function (a) {
          var v = el.getAttribute(a);
          if (v && !/^(https?:|mailto:|tel:|#|data:|\/)/i.test(v)) el.setAttribute(a, lien(r.base, v));
        });
        if (el.tagName === "A" && !/^#/.test(el.getAttribute("href") || "")) el.setAttribute("target", "_blank");
      });
      box.innerHTML = doc.body.innerHTML;
      preparerContenu(box, r);
      /* la barre de filtres remonte au-dessus de la première carte : elle filtre la carte et la liste */
      var cm = box.querySelector(".carte-mss"), fl = box.parentNode.querySelector(".rub-filtres");
      /* les éléments marqués class="apres-fiches" s'affichent sous la liste des fiches */
      var rc = $("rcards");
      if (rc) Array.prototype.slice.call(box.querySelectorAll(".apres-fiches")).reverse().forEach(function (el) { rc.parentNode.insertBefore(el, rc.nextSibling); });
      if (fl && !cm && r.cfg && /^oui/i.test(String(r.cfg.val("Filtres en haut") || "").trim())) {
        box.parentNode.insertBefore(fl, box); fl.classList.add("filtres-carte");
      } else if (cm && fl) {
        var ancre = cm.previousElementSibling && /^H[23]$/.test(cm.previousElementSibling.tagName) ? cm.previousElementSibling : cm;
        var ent = document.createElement("div"); ent.className = "filtres-carte-titre"; ent.textContent = "Filtrer les MSS (carte et liste)";
        ancre.parentNode.insertBefore(ent, ancre); ancre.parentNode.insertBefore(fl, ancre); fl.classList.add("filtres-carte");
      }
      majCarte(r);
    }).catch(function () { var box = $("rubPage"); if (!box) return; if (r.pageDeclaree) box.innerHTML = '<div class="alerte">⚠️ Fichier <b>' + esc(r.base + r.page) + "</b> introuvable.</div>"; else box.remove(); });

    if (r.blocs.length) {
      var rendu = function () {
        var res = filtrer(r.blocs, $("rq") ? $("rq").value : "", $("rs") ? $("rs").value : "", $("rd") ? $("rd").value : "", "", $("re") ? $("re").value : "");
        document.querySelectorAll("#viewRub select[data-champ]").forEach(function (sel) {
          if (sel.value) res = res.filter(function (b) { return valeursChamp(b, sel.getAttribute("data-champ")).indexOf(sel.value) >= 0; });
        });
        $("rc").textContent = r.blocs.length > 3 ? res.length + " sur " + r.blocs.length : "";
        $("rcards").innerHTML = res.length ? res.map(function (b) { return carte(b, "", false, r.filtres); }).join("") : '<div class="empty">Aucun résultat.</div>';
        Array.prototype.forEach.call($("rcards").children, function (el, i) { if (res[i]) el.setAttribute("data-bloc", r.blocs.indexOf(res[i])); });
        r._res = res; r._filtre = res.length !== r.blocs.length; majCarte(r);
      };
      ["rq", "rs", "rd", "re"].forEach(function (id) { if ($(id)) $(id).addEventListener(id === "rq" ? "input" : "change", rendu); });
      document.querySelectorAll("#viewRub select[data-champ]").forEach(function (sel) { sel.addEventListener("change", rendu); });
      rendu();
    }
  }
  /* Carte des MSS : image + points reliés aux fiches (champ « Carte : numéro | x % | y % ») */
  function pointsCarte(b) {
    var v = valeurAutre(b, "Carte"); if (!v) return null;
    var p = v.split("|").map(function (s) { return s.trim(); }), x = parseFloat(String(p[1]).replace(",", ".")), y = parseFloat(String(p[2]).replace(",", "."));
    return isNaN(x) || isNaN(y) ? null : { num: p[0], x: x, y: y };
  }
  function majCarte(r) {
    var box = document.querySelector("#viewRub [data-carte-mss]"); if (!box) return;
    if (!box.getAttribute("data-pret")) {
      box.innerHTML = '<div class="cmss-zone"><img src="' + esc(lien(r.base, box.getAttribute("data-carte-mss"))) + '" alt="Carte des Maisons Sport-Santé de Bretagne"><div class="cmss-pts"></div><div class="cmss-pop" hidden></div></div><div class="cmss-info"></div>';
      box.setAttribute("data-pret", "1");
      box.querySelector(".cmss-zone").addEventListener("click", function () { box.querySelector(".cmss-pop").hidden = true; });
    }
    var res = r._res || r.blocs, zone = box.querySelector(".cmss-zone"), pts = box.querySelector(".cmss-pts"), pop = box.querySelector(".cmss-pop");
    var tot = r.blocs.filter(pointsCarte).length, n = 0;
    pts.innerHTML = res.map(function (b) {
      var p = pointsCarte(b); if (!p) return ""; n++;
      return '<button type="button" class="cmss-pt" style="left:' + p.x + "%;top:" + p.y + '%" data-i="' + r.blocs.indexOf(b) + '" title="' + esc(b.nom) + '">' + esc(p.num) + "</button>";
    }).join("");
    zone.classList.toggle("filtree", !!r._filtre);
    box.querySelector(".cmss-info").textContent = r._filtre ? n + " MSS affichée" + (n > 1 ? "s" : "") + " sur " + tot + " selon les filtres ci-dessus · cliquez sur un numéro pour voir la fiche" : tot + " MSS sur la carte · utilisez les filtres ci-dessus pour n'afficher que certaines MSS · cliquez sur un numéro pour voir la fiche";
    pop.hidden = true;
    pts.querySelectorAll(".cmss-pt").forEach(function (bt) {
      bt.addEventListener("click", function (e) {
        e.stopPropagation();
        var i = +bt.getAttribute("data-i"), b = r.blocs[i];
        pop.style.left = bt.style.left; pop.style.top = bt.style.top;
        pop.classList.toggle("a-gauche", parseFloat(bt.style.left) > 70);
        pop.innerHTML = "<b>" + esc(b.nom) + "</b><br>" + esc([b.ville, b.statut].filter(Boolean).join(" · ")) + (b.telephone ? "<br>📞 " + esc(b.telephone) : "") + '<br><a href="#" class="cmss-voir">Voir la fiche ↓</a>';
        pop.hidden = false;
        pop.querySelector(".cmss-voir").addEventListener("click", function (ev) {
          ev.preventDefault();
          var c = document.querySelector('#rcards [data-bloc="' + i + '"]');
          if (c) { c.scrollIntoView({ behavior: "smooth", block: "center" }); c.classList.add("flash"); setTimeout(function () { c.classList.remove("flash"); }, 1800); }
        });
      });
    });
  }
  /* Carte : pour uMap, désactive le zoom à la molette (évite de bloquer le défilement de la page) */
  function urlCarte(u) {
    if (!/umap\.openstreetmap/i.test(u) || /[?&]scrollWheelZoom=/.test(u)) return u;
    var i = u.indexOf("#"), base = i >= 0 ? u.slice(0, i) : u, hash = i >= 0 ? u.slice(i) : "";
    return base + (base.indexOf("?") >= 0 ? "&" : "?") + "scrollWheelZoom=false&fullscreenControl=true&captionBar=false" + hash;
  }
  var ICO = { pdf: "📕", doc: "📘", docx: "📘", odt: "📘", xls: "📗", xlsx: "📗", ods: "📗", csv: "📗", ppt: "📙", pptx: "📙", odp: "📙", png: "🖼️", jpg: "🖼️", jpeg: "🖼️", svg: "🖼️", mp4: "🎬", mp3: "🎧", zip: "🗜️" };

  /* ---------- PDF : tout le kit dans un document imprimable (Enregistrer au format PDF) ---------- */
  function pagePourPdf(r) {
    if (!r.page) return Promise.resolve("");
    return lireTexte(r.base + r.page).then(function (html) {
      var doc = new DOMParser().parseFromString(html, "text/html");
      doc.querySelectorAll("script,style").forEach(function (x) { x.remove(); });
      doc.querySelectorAll("iframe").forEach(function (f) {
        var src = f.getAttribute("src") || "", p = doc.createElement("p");
        p.className = "p-lien";
        p.innerHTML = "🗺️ " + esc(f.getAttribute("title") || "Contenu en ligne") + " : <a href=\"" + esc(src) + "\">" + esc(src.split("?")[0].split("#")[0]) + "</a>";
        f.replaceWith(p);
      });
      doc.querySelectorAll("[href],[src]").forEach(function (el) {
        ["href", "src"].forEach(function (a) { var v = el.getAttribute(a); if (v && !/^(https?:|mailto:|tel:|#|data:|\/)/i.test(v)) el.setAttribute(a, new URL(lien(r.base, v), location.href).href); });
      });
      return doc.body.innerHTML;
    }).catch(function () { return ""; });
  }
  /* Fenêtre d'options */
  function ouvrirOptionsPdf() {
    $("pdfRubriques").innerHTML = S.rubriques.map(function (r, i) {
      return '<label><input type="checkbox" name="pdfRub" value="' + i + '" checked> ' + esc(r.titre) + "</label>";
    }).join("");
    majNotePdf();
    $("pdfRubriques").onchange = majNotePdf;
    $("pdfModal").hidden = false;
  }
  function rubChoisies() { return Array.prototype.filter.call(document.querySelectorAll("input[name=pdfRub]"), function (c) { return c.checked; }).map(function (c) { return S.rubriques[+c.value]; }); }
  function joignable(d) { return !/^https?:/i.test(d.fichier) && /\.(pdf|png|jpe?g)$/i.test(d.fichier); }
  function majNotePdf() {
    var docs = []; rubChoisies().forEach(function (r) { docs = docs.concat(r.documents); });
    var loc = docs.filter(joignable).length, ext = docs.length - loc;
    $("pdfNote").textContent = loc + " document" + (loc > 1 ? "s" : "") + " joignable" + (loc > 1 ? "s" : "") + " en annexe" +
      (ext ? " · " + ext + " lien" + (ext > 1 ? "s" : "") + " vers des sites externes (non joignables, conservés comme liens)" : "") + ".";
  }
  $("pdfTout").onclick = function () {
    var cs = document.querySelectorAll("input[name=pdfRub]"), tous = Array.prototype.every.call(cs, function (c) { return c.checked; });
    cs.forEach(function (c) { c.checked = !tous; }); majNotePdf();
  };
  $("pdfAnnuler").onclick = function () { $("pdfModal").hidden = true; };
  $("pdfForm").onsubmit = function (e) {
    e.preventDefault();
    var rubs = rubChoisies();
    if (!rubs.length) { alerteModal("Cochez au moins une rubrique."); return; }
    $("pdfModal").hidden = true;
    genererPdf({ rubriques: rubs, couverture: $("pdfCouv").checked, textes: $("pdfTextes").checked, fiches: $("pdfFiches").checked, docs: $("pdfDocs").checked, annexes: $("pdfAnnexes").checked });
  };
  function alerteModal(t) { $("pdfNote").textContent = "⚠️ " + t; }

  /* Annexes : vrais fichiers assemblés avec pdf-lib (assets/vendor/pdf-lib.min.js, licence MIT) */
  function chargerPdfLib() {
    if (window.PDFLib) return Promise.resolve(window.PDFLib);
    return new Promise(function (ok, ko) { var sc = document.createElement("script"); sc.src = "assets/vendor/pdf-lib.min.js"; sc.onload = function () { ok(window.PDFLib); }; sc.onerror = ko; document.head.appendChild(sc); });
  }
  function winAnsi(t) { return String(t).replace(/[^\x20-\x7E\xA0-\xFF’‘“”–—…œŒ€]/g, ""); }
  function construireAnnexes(rubs) {
    var liste = [];
    rubs.forEach(function (r) { r.documents.filter(joignable).forEach(function (d) { liste.push({ r: r, d: d }); }); });
    if (!liste.length) return Promise.resolve(null);
    return chargerPdfLib().then(function (L) {
      return L.PDFDocument.create().then(function (out) {
        return out.embedFont(L.StandardFonts.HelveticaBold).then(function (gras) {
          return out.embedFont(L.StandardFonts.Helvetica).then(function (normal) {
            var num = 0, joints = [];
            var chaine = liste.reduce(function (p, it) {
              return p.then(function () {
                return fetch(it.d.url).then(function (rep) { if (!rep.ok) throw 0; return rep.arrayBuffer(); }).then(function (buf) {
                  num++;
                  var nom = it.d.libelle || it.d.fichier.split("/").pop(), pg = out.addPage([595.28, 841.89]);
                  pg.drawText("Annexe " + num, { x: 60, y: 560, size: 34, font: gras, color: L.rgb(0.07, 0.31, 0.29) });
                  pg.drawText(winAnsi(nom).slice(0, 70), { x: 60, y: 515, size: 16, font: gras });
                  pg.drawText(winAnsi("Rubrique : " + it.r.titre).slice(0, 80), { x: 60, y: 488, size: 12, font: normal, color: L.rgb(0.35, 0.35, 0.35) });
                  var fin;
                  if (/\.pdf$/i.test(it.d.fichier)) {
                    fin = L.PDFDocument.load(buf, { ignoreEncryption: true }).then(function (src) {
                      return out.copyPages(src, src.getPageIndices()).then(function (pages) { pages.forEach(function (x) { out.addPage(x); }); });
                    });
                  } else {
                    fin = (/\.png$/i.test(it.d.fichier) ? out.embedPng(buf) : out.embedJpg(buf)).then(function (img) {
                      var p2 = out.addPage([595.28, 841.89]), s = Math.min(495 / img.width, 742 / img.height, 1);
                      p2.drawImage(img, { x: (595.28 - img.width * s) / 2, y: (841.89 - img.height * s) / 2, width: img.width * s, height: img.height * s });
                    });
                  }
                  return fin.then(function () { it.annexe = num; joints.push(it); });
                }).catch(function () { /* fichier illisible : ignoré, le lien reste dans le document */ });
              });
            }, Promise.resolve());
            return chaine.then(function () { return joints.length ? out.save().then(function (bytes) { return { bytes: bytes, joints: joints }; }) : null; });
          });
        });
      });
    });
  }

  function genererPdf(o) {
    var btn = $("btnPdf"), R = S.reglages;
    btn.disabled = true; btn.textContent = "⏳ Préparation du document…";
    var date = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    var pAnnexes = o.annexes ? construireAnnexes(o.rubriques).catch(function () { return null; }) : Promise.resolve(null);
    Promise.all([Promise.all(o.rubriques.map(function (r) { return o.textes ? pagePourPdf(r) : ""; })), pAnnexes]).then(function (res) {
      var pages = res[0], annexes = res[1], numAnnexe = {};
      if (annexes) annexes.joints.forEach(function (it) { numAnnexe[it.d.url] = it.annexe; });
      var h = "";
      if (o.couverture) {
        h += '<section class="p-couverture"><div class="p-titre">' + esc(R.titre) + "</div>" +
          (R.soustitre ? '<div class="p-sous">' + esc(R.soustitre) + "</div>" : "") +
          (R.accueil ? '<p class="p-accueil">' + esc(R.accueil) + "</p>" : "") +
          '<div class="p-date">Édition du ' + esc(date) + '</div><div class="p-url">Version en ligne : ' + esc(location.href.split("#")[0]) + "</div></section>";
        h += '<section class="p-sommaire"><h1>Sommaire</h1><ol>';
        o.rubriques.forEach(function (r, i) {
          var n = r.blocs.filter(function (b) { return !b.erreur; }).length;
          h += '<li><a href="#p-sec-' + (i + 1) + '">' + esc(r.titre) + "</a>" + (o.fiches && n ? ' <span class="p-nb">' + n + " fiche" + (n > 1 ? "s" : "") + "</span>" : "") + "</li>";
        });
        h += "</ol>" + (annexes ? '<p class="p-annexes">📎 ' + annexes.joints.length + " document" + (annexes.joints.length > 1 ? "s" : "") + " joint" + (annexes.joints.length > 1 ? "s" : "") + " dans le fichier « " + esc(R.titre) + " - annexes.pdf ».</p>" : "") + "</section>";
      }
      o.rubriques.forEach(function (r, i) {
        h += '<section class="p-section' + (i === 0 && !o.couverture ? " p-premiere" : "") + '" id="p-sec-' + (i + 1) + '"><h1><span class="p-num">' + (i + 1) + ".</span> " + esc(r.titre) + "</h1>";
        if (r.intro) h += '<p class="p-intro">' + esc(r.intro).replace(/\n/g, "<br>") + "</p>";
        if (pages[i]) h += '<div class="contenu">' + pages[i] + "</div>";
        var blocs = r.blocs.filter(function (b) { return !b.erreur; });
        if (o.fiches && blocs.length) {
          h += "<h2>" + esc(r.titreBlocs || "Fiches") + "</h2><div class=\"cards\">" +
            blocs.map(function (b) { return carte(Object.assign({}, b, { logos: [] }), "", false); }).join("") + "</div>";
        }
        if (o.docs && r.documents.length) {
          h += "<h2>" + esc(r.titreDocs || "Documents") + "</h2>";
          groupesDocs(r).forEach(function (g) {
            if (!g.docs.length) return;
            if (g.nom) h += '<h3 class="p-cat">' + esc(g.nom) + "</h3>";
            h += "<ul class=\"p-docs\">" + g.docs.map(function (d) {
              var u = new URL(d.url, location.href).href, nom = d.libelle || d.fichier.split("/").pop();
              return "<li>" + esc(nom) + (numAnnexe[d.url] ? ' <b class="p-badge">annexe ' + numAnnexe[d.url] + "</b>" : "") + ' : <a href="' + esc(u) + '">' + esc(u) + "</a></li>";
            }).join("") + "</ul>";
          });
        }
        h += "</section>";
      });
      $("print").innerHTML = h;
      if (annexes) {
        var a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([annexes.bytes], { type: "application/pdf" }));
        a.download = R.titre + " - annexes.pdf"; document.body.appendChild(a); a.click(); a.remove();
      }
      var ancien = document.title;
      document.title = R.titre + " - " + date;
      var fin = function () { document.title = ancien; $("print").innerHTML = ""; btn.disabled = false; btn.textContent = "📄 Générer le kit en format PDF"; window.removeEventListener("afterprint", fin); };
      window.addEventListener("afterprint", fin);
      setTimeout(function () { window.print(); }, 400);
    });
  }
  /* ---------- Contenus automatiques et livret PDF ---------- */
  function valeurAutre(b, cle0) { var a = b.autres.filter(function (x) { return cle(x[0]) === cle(cle0); })[0]; return a ? a[1] : ""; }
  /* Filtres du livret (département, statut juridique) */
  var LV = { dept: "", statut: "" };
  function estRegional(b) { var d = String(b.departement || ""); return !d || /toute|bretagne|r[ée]gion/i.test(d); }
  function deptOk(b) { return !LV.dept || estRegional(b) || String(b.departement).trim() === LV.dept; }
  function blocsDe(re) { var r = S.rubriques.filter(function (x) { return re.test(x.titre); })[0]; return r ? r.blocs.filter(function (b) { return !b.erreur; }) : []; }
  function aCompleter(v) { return v && !/^[àa] compl[ée]ter/i.test(v) ? esc(v) : "—"; }
  function lienLv(u) {
    if (!u) return "—";
    u = String(u).split(/\s+/)[0];
    var txt = u.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
    if (txt.length > 42) txt = txt.slice(0, 40) + "…";
    return '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(txt) + "</a>";
  }
  function lienDomaine(u) { if (!u) return "—"; u = String(u).split(/\s+/)[0]; return '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(u.replace(/^https?:\/\/(www\.)?/i, "").split("/")[0])+ "</a>"; }
  function tableFinancements() {
    var bl = blocsDe(/financ/i).filter(deptOk).filter(function (b) {
      var el = valeurAutre(b, "Statuts éligibles");
      return !LV.statut || !el || norm(el).indexOf(norm(LV.statut)) >= 0;
    });
    bl = bl.filter(function (b) { return !/^non$/i.test(String(valeurAutre(b, "Livret") || "").trim()); });
    if (!bl.length) return '<p class="vide-cat">Aucune fiche dans la rubrique Financements.</p>';
    var lignes = bl.map(function (b) { return [b.emetteur || "", b.nom, valeurAutre(b, "Montant") || "—", b.site]; });
    if (!LV.dept) {
      /* sans filtre département : les dispositifs départementaux sont regroupés sur une ligne */
      var dep = bl.filter(function (b) { return !estRegional(b); });
      if (dep.length > 1) {
        var nums = dep.map(function (b) { return String(b.departement).trim().slice(0, 2); }).sort().join(", ");
        lignes = bl.filter(estRegional).map(function (b) { return [b.emetteur || "", b.nom, valeurAutre(b, "Montant") || "—", b.site]; });
        lignes.push(["Conférences des financeurs (" + nums + ")", "Appels à projets de prévention de la perte d'autonomie (60 ans et +), un par département", "—", "https://www.pourbienvieillirbretagne.fr/appel-a-projets/"]);
      }
    }
    return '<table class="lv-table lv-compact lv-fin"><tr><th>Émetteur</th><th>Dispositif</th><th>Montant</th><th>Lien</th></tr>' + lignes.map(function (l) {
      return "<tr><td><b>" + esc(l[0]) + "</b></td><td>" + esc(l[1]) + "</td><td>" + esc(l[2]) + "</td><td>" + lienDomaine(l[3]) + "</td></tr>";
    }).join("") + "</table>";
  }
  var ORDRE_CONTACTS = ["collectifmss", "ars", "delegationdepartementalears", "drajes", "sdjes", "referentcollectif"];
  function typeContact(b) { return cle(valeurAutre(b, "Type de contact")); }
  function coordsLv(b, court) {
    return [!court && b.adresse ? esc(b.adresse) : "", b.telephone ? "☎ " + esc(b.telephone) : "", b.email ? "✉ " + esc(b.email) : ""].filter(Boolean).join("<br>");
  }
  function tableReferents() {
    var bl = S.blocs.filter(function (b) { return !b.erreur && valeurAutre(b, "Type de contact") && deptOk(b); });
    if (!bl.length) return '<p class="vide-cat">Aucun contact pour ce département.</p>';
    function rang(b) { var i = ORDRE_CONTACTS.indexOf(typeContact(b)); return i < 0 ? 9 : i; }
    bl.sort(function (x, y) { return (estRegional(y) - estRegional(x)) || trier(x.departement || "", y.departement || "") || rang(x) - rang(y); });
    function ligne(b, court) {
      var ref = b.contact || "";
      return "<tr><td><b>" + esc(b.nom) + "</b><br><small>" + esc(valeurAutre(b, "Type de contact")) + "</small></td><td>" + (coordsLv(b, court) || "—") + "</td><td>" + aCompleter(ref) + "</td></tr>";
    }
    var tete = '<table class="lv-table lv-compact"><tr><th>Interlocuteur</th><th>Coordonnées</th><th>Référent</th></tr>';
    if (LV.dept) return tete + bl.map(function (b) { return ligne(b); }).join("") + "</table>";
    // Sans filtre : institutions régionales, puis un tableau par département
    var reg = bl.filter(estRegional), dep = bl.filter(function (b) { return !estRegional(b); });
    var h = tete + reg.map(function (b) { return ligne(b); }).join("") + "</table>";
    var deps = {}; dep.forEach(function (b) { (deps[b.departement] = deps[b.departement] || {})[typeContact(b)] = b; });
    var cols = [["delegationdepartementalears", "Délégation ARS"], ["sdjes", "SDJES"], ["referentcollectif", "Référent du collectif"]];
    h += '<h3 class="lv-sous">Dans chaque département</h3><table class="lv-table lv-compact lv-dep"><tr><th>Département</th>' + cols.map(function (c) { return "<th>" + c[1] + "</th>"; }).join("") + "</tr>";
    Object.keys(deps).sort(trier).forEach(function (d) {
      h += "<tr><td><b>" + esc(d) + "</b></td>" + cols.map(function (c) {
        var b = deps[d][c[0]];
        if (!b) return "<td>—</td>";
        return "<td>" + (c[0] === "referentcollectif" && b.contact ? "<b>" + esc(b.contact) + "</b><br>" : "") + (coordsLv(b, true) || "—") + "</td>";
      }).join("") + "</tr>";
    });
    return h + "</table>";
  }
  function listeMSS() {
    var bl = blocsDe(/liste\s*mss|mss\s*collectif/i).filter(function (b) {
      return (!LV.dept || String(b.departement || "").trim() === LV.dept) && (!LV.statut || String(b.statut || "").trim() === LV.statut);
    }).sort(function (x, y) { return trier(x.departement || "", y.departement || "") || trier(x.nom, y.nom); });
    if (!bl.length) return '<p class="vide-cat">Aucune MSS ne correspond à ce département et à ce statut juridique.</p>';
    return '<ul class="lv-mss' + (LV.dept ? "" : " lv-mss3") + '">' + bl.map(function (b) {
      var c = LV.dept ? [b.telephone, b.email].filter(Boolean).map(esc).join(" · ") : "";
      return "<li><b>" + esc(b.nom) + "</b> — " + esc(b.ville || "") + (LV.dept ? "" : " (" + esc(String(b.departement || "").slice(0, 2)) + ")") + (LV.statut || !LV.dept ? "" : " · <i>" + esc(b.statut || "") + "</i>") + (c ? "<br><small>" + c + "</small>" : "") + "</li>";
    }).join("") + "</ul>";
  }
  function tableFormations() {
    var bl = blocsDe(/formation/i);
    if (!bl.length) return '<p class="vide-cat">Aucune fiche dans la rubrique Formations.</p>';
    function dom(u) { if (!u) return "—"; u = String(u).split(/\s+/)[0]; return '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(u.replace(/^https?:\/\/(www\.)?/i, "").split("/")[0]) + "</a>"; }
    function nomLie(b) { var u = b.site ? String(b.site).split(/\s+/)[0] : ""; return u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener"><b>' + esc(b.nom) + "</b></a>" : "<b>" + esc(b.nom) + "</b>"; }
    return '<table class="lv-table lv-compact lv-form"><tr><th>Formation (lien vers le site)</th><th>Organisme et lieu</th><th>Durée / format</th></tr>' + bl.map(function (b) {
      return "<tr><td>" + nomLie(b) + "</td><td>" + esc(b.emetteur || "—") + (b.ville || b.departement ? " · " + esc(b.ville || b.departement) : "") + "</td><td>" + esc(valeurAutre(b, "Durée") || "—") + "</td></tr>";
    }).join("") + "</table>";
  }
  function outilsCom() {
    var r = S.rubriques.filter(function (x) { return /document|mod[eè]le/i.test(x.titre) && (x.categories.length || x.documents.length); })[0];
    if (!r) return "";
    return '<div class="lv-outils">' + groupesDocs(r).filter(function (g) { return !/plaidoyer|cahiers/i.test(g.nom || ""); }).map(function (g) {
      return '<div class="lv-carte"><b>' + iconeCategorie(g.nom) + " " + esc(g.nom || "Documents") + "</b>" +
        (g.docs.length ? "<ul>" + g.docs.map(function (d) { return "<li>" + lienLv(d.url).replace(/>[^<]*<\/a>$/, ">" + esc(d.libelle || d.fichier.split("/").pop()) + "</a>") + "</li>"; }).join("") + "</ul>" : '<br><small>Modèles à venir.</small>') + "</div>";
    }).join("") + "</div>";
  }
  var AUTO = { financements: tableFinancements, referents: tableReferents, mss: listeMSS, formations: tableFormations, "outils-com": outilsCom };
  function remplirAuto(box) {
    Object.keys(AUTO).forEach(function (k) { box.querySelectorAll('[data-auto="' + k + '"]').forEach(function (x) { x.innerHTML = AUTO[k](x); }); });
    box.querySelectorAll("[data-filtre-livret]").forEach(function (x) {
      x.textContent = (LV.dept || LV.statut) ? "Édition filtrée : " + [LV.dept ? LV.dept.replace(/^\d+\s*-\s*/, "") : "", LV.statut].filter(Boolean).join(" · ") : "Toute la Bretagne, tous statuts juridiques";
    });
  }
  function preparerContenu(box, r) {
    remplirAuto(box);
    var lv = box.querySelector("[data-livret]");
    if (!lv) return;
    var pages = remplirLivret(lv);
    var barre = document.createElement("div");
    barre.className = "lv-barre";
    barre.innerHTML = '<button type="button" class="btn-primaire" id="btnLivret">📘 Générer le livret d\'accueil</button><span>Couverture + ' + pages.length + " pages A4 · filtres département et statut juridique proposés à l'étape suivante.</span>";
    lv.parentNode.insertBefore(barre, lv);
    $("btnLivret").onclick = function () { var btn = this; ouvrirOptionsLivret(function () { remplirLivret(lv); genererLivret(r, lv, btn); }); };
  }
  function ouvrirOptionsLivret(suite) {
    var dps = uniq(blocsDe(/liste\s*mss|mss\s*collectif/i), "departement");
    var sts = uniq(blocsDe(/liste\s*mss|mss\s*collectif/i), "statut");
    function opts(sel, v, tous) { sel.innerHTML = '<option value="">' + tous + "</option>"; remplir(sel, v); }
    opts($("lvDept"), dps, "Toute la Bretagne"); opts($("lvStatut"), sts, "Tous les statuts juridiques");
    $("lvDept").value = LV.dept; $("lvStatut").value = LV.statut;
    $("livretModal").hidden = false;
    $("lvAnnuler").onclick = function () { $("livretModal").hidden = true; };
    $("livretForm").onsubmit = function (e) { e.preventDefault(); LV.dept = $("lvDept").value; LV.statut = $("lvStatut").value; $("livretModal").hidden = true; suite(); };
  }
  function remplirLivret(lv) {
    remplirAuto(lv);
    lv.querySelectorAll(".livret-page[data-optionnel]").forEach(function (p) {
      var vide = !Array.prototype.some.call(p.querySelectorAll("[data-auto]"), function (x) { return x.innerHTML.trim(); });
      p.classList.toggle("lv-vide", vide);
    });
    var pages = lv.querySelectorAll(".livret-page:not(.lv-vide)");
    pages.forEach(function (p, i) { p.setAttribute("data-num", "Page " + (i + 1)); });
    var som = "<ol class=\"lv-sommaire\">";
    pages.forEach(function (p, i) { var t = p.getAttribute("data-titre"); if (t && i > 0) som += "<li><span>" + esc(t) + "</span><i></i><b>" + (i + 1) + "</b></li>"; });
    som += "</ol>";
    lv.querySelectorAll('[data-auto="sommaire"]').forEach(function (x) { x.innerHTML = som; });
    return pages;
  }
  /* Bouton de la page d'accueil : charge la rubrique qui contient le livret, puis le génère */
  function livretDepuisAccueil(btn) {
    var cands = S.rubriques.filter(function (r) { return r.page; });
    cands.sort(function (a, b) { return (/livret/i.test(b.titre) ? 1 : 0) - (/livret/i.test(a.titre) ? 1 : 0); });
    btn.disabled = true; btn.textContent = "⏳ Préparation…";
    var essai = function (i) {
      if (i >= cands.length) { btn.disabled = false; btn.textContent = "📘 Générer le livret d'accueil"; return; }
      var r = cands[i];
      lireTexte(r.base + r.page).then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html"), lv = doc.querySelector("[data-livret]");
        if (!lv) return essai(i + 1);
        lv.querySelectorAll("[src]").forEach(function (el) { var v = el.getAttribute("src"); if (v && !/^(https?:|data:|\/)/i.test(v)) el.setAttribute("src", lien(r.base, v)); });
        var tmp = document.createElement("div"); tmp.appendChild(document.importNode(lv, true));
        genererLivret(r, remplirLivretEtRendre(tmp.firstChild), btn);
      }).catch(function () { essai(i + 1); });
    };
    essai(0);
  }
  function remplirLivretEtRendre(lv) { remplirLivret(lv); return lv; }
  function trouverImage(cands) {
    return cands.reduce(function (p, u) {
      return p.then(function (ok) { return ok || fetch(chemin(u), { method: "HEAD", cache: "no-store" }).then(function (x) { return x.ok ? chemin(u) : null; }).catch(function () { return null; }); });
    }, Promise.resolve(null));
  }
  function genererLivret(r, lv, btn) {
    var R = S.reglages, c = r.cfg;
    btn.disabled = true; btn.textContent = "⏳ Préparation…";
    var cands = LOGOS.map(function (f) { return r.base + f; }).concat(R.logo ? [R.logo] : LOGOS.map(function (f) { return "logo/" + f; }));
    trouverImage(cands).then(function (logo) {
      var titre = c.val("Titre du livret") || r.titre, sous = c.val("Sous-titre du livret"), mention = c.val("Mention du livret") || R.titre;
      var annee = new Date().getFullYear();
      var h = '<section class="lv-cover">' +
        (logo ? '<img class="lv-logo" src="' + esc(logo) + '" alt="">' : '<div class="lv-logo lv-logo-vide">MSS<br>BZH</div>') +
        '<div class="lv-cover-titre">' + esc(titre) + "</div>" + (sous ? '<div class="lv-cover-sous">' + esc(sous) + "</div>" : "") +
        '<div class="lv-cover-pied"><b>' + esc(mention) + "</b><br>Édition " + annee + ((LV.dept || LV.statut) ? "<br>" + esc([LV.dept ? LV.dept.replace(/^\d+\s*-\s*/, "") : "", LV.statut].filter(Boolean).join(" · ")) : "") + "</div></section>";
      var pages = lv.querySelectorAll(".livret-page:not(.lv-vide)");
      pages.forEach(function (p, i) {
        h += '<section class="lv-page">' + p.innerHTML + '<div class="lv-pied"><span>' + esc(sous || titre) + "</span><span>" + (i + 1) + "</span></div></section>";
      });
      $("print").className = "livret-print";
      $("print").innerHTML = h;
      var imgs = $("print").querySelectorAll("img");
      return Promise.all(Array.prototype.map.call(imgs, function (im) { return im.complete ? 1 : new Promise(function (ok) { im.onload = im.onerror = ok; setTimeout(ok, 4000); }); }));
    }).then(function () {
      var ancien = document.title;
      document.title = (c.val("Titre du livret") || r.titre).replace(/[\\/:*?"<>|]/g, "") + " - livret";
      var fin = function () { document.title = ancien; $("print").innerHTML = ""; $("print").className = ""; btn.disabled = false; btn.textContent = "📘 Générer le livret d'accueil"; window.removeEventListener("afterprint", fin); LV.dept = ""; LV.statut = ""; if (document.body.contains(lv)) remplirLivret(lv); };
      window.addEventListener("afterprint", fin);
      setTimeout(function () { window.print(); }, 300);
    });
  }

  /* Regroupe les documents : catégories déclarées (même vides), sinon sous-dossiers */
  function groupesDocs(r) {
    var out = [], idx = {};
    function g(nom) { if (!(nom in idx)) { idx[nom] = out.length; out.push({ nom: nom, docs: [] }); } return out[idx[nom]]; }
    if (r.categories.length) {
      if (r.documents.some(function (d) { return !d.categorie; })) g("");
      r.categories.forEach(g);
      r.documents.forEach(function (d) { g(d.categorie).docs.push(d); });
    } else {
      r.documents.forEach(function (d) {
        var parts = /^https?:/i.test(d.fichier) ? [d.fichier] : d.fichier.replace(/^documents\//i, "").split("/");
        g(parts.length > 1 ? parts[0] : "").docs.push(d);
      });
    }
    return out;
  }
  function iconeCategorie(n) {
    return /vid[ée]o|capsule/i.test(n) ? "🎬" : /convention|contrat/i.test(n) ? "📝" : /communication|affiche|flyer/i.test(n) ? "📣" : /formulaire|fiche/i.test(n) ? "🗂️" : "📁";
  }
  function docHtml(d) {
    var nom = d.fichier.split("/").pop(), ext = /^https?:/i.test(d.fichier) ? "lien" : (nom.split(".").pop() || "").toLowerCase();
    var lib = d.libelle || (ext === "lien" ? d.fichier.replace(/^https?:\/\//i, "").replace(/\/$/, "") : nom.replace(/\.[^.]+$/, "").replace(/_+/g, " "));
    var video = /youtu\.?be|vimeo|dailymotion|peertube|\.mp4$/i.test(d.fichier);
    return '<li><a href="' + esc(d.url) + '" target="_blank" rel="noopener">' + (video ? "🎬" : ext === "lien" ? "🔗" : ICO[ext] || "📄") + " " + esc(lib) + ' <small>' + esc(video ? "VIDÉO" : ext.toUpperCase()) + "</small></a></li>";
  }

  /* ---------- vue Recherche ---------- */
  var derniers = [], indexPages = null;
  function chargerIndexPages() {
    if (indexPages) return indexPages;
    indexPages = Promise.all(S.rubriques.map(function (r) {
      if (!r.page) return Promise.resolve("");
      return lireTexte(r.base + r.page).then(function (html) {
        var d = new DOMParser().parseFromString(html, "text/html");
        d.querySelectorAll("script,style").forEach(function (x) { x.remove(); });
        d.querySelectorAll("td,th,li,p,h2,h3,div,br").forEach(function (x) { x.appendChild(d.createTextNode(" ")); });
        return (d.body.textContent || "").replace(/\s+/g, " ").trim();
      }).catch(function () { return ""; });
    })).then(function (t) { S.rubriques.forEach(function (r, i) { r._texte = t[i]; r._ntexte = norm(t[i]); }); });
    return indexPages;
  }
  function extrait(texte, ntexte, mots) {
    var i = ntexte.indexOf(mots[0]); if (i < 0) i = 0;
    var deb = Math.max(0, i - 70), fin = Math.min(texte.length, i + 150);
    return (deb > 0 ? "…" : "") + surligner(texte.slice(deb, fin), mots) + (fin < texte.length ? "…" : "");
  }
  function rechercher() {
    var q = $("q").value.trim(), rubSel = $("fRub").value, cat = $("fType").value;
    var mots = norm(q).split(/\s+/).filter(Boolean);
    var tous = filtrer(S.blocs, q, $("fStatut").value, $("fDept").value, "", "", cat);
    derniers = tous.filter(function (b) { return !rubSel || b.rubrique === rubSel; });
    derniers.sort(mots.length ? function (a, b) { return score(b, mots) - score(a, mots) || trier(a.nom, b.nom); } : function (a, b) { return trier(a.nom, b.nom); });
    /* pastilles par rubrique avec le nombre de résultats */
    var nb = {}; tous.forEach(function (b) { nb[b.rubrique] = (nb[b.rubrique] || 0) + 1; });
    $("rubChips").innerHTML = S.rubriques.filter(function (r) { return nb[r.titre]; }).map(function (r) {
      return '<button type="button" class="chip' + (rubSel === r.titre ? " actif" : "") + '" data-rub="' + esc(r.titre) + '">' + icone(r.titre) + " " + esc(r.titre) + " <b>" + nb[r.titre] + "</b></button>";
    }).join("") + (rubSel ? '<button type="button" class="chip tout" data-rub="">✕ Toutes les rubriques</button>' : "");
    $("rubChips").querySelectorAll(".chip").forEach(function (c) { c.onclick = function () { $("fRub").value = c.getAttribute("data-rub"); rechercher(); }; });
    $("results").innerHTML = derniers.length ? derniers.map(function (b) { return carte(b, mots, true); }).join("") : '<div class="empty">Aucune fiche ne correspond. Essayez un autre mot ou élargissez les filtres.</div>';
    var compte = function (nP, nD) {
      var t = derniers.length + " fiche" + (derniers.length > 1 ? "s" : "") + " sur " + S.blocs.length;
      if (nP) t += " · " + nP + " page" + (nP > 1 ? "s" : "");
      if (nD) t += " · " + nD + " document" + (nD > 1 ? "s" : "");
      $("count").textContent = t;
    };
    compte(0, 0);
    $("pagesRes").innerHTML = "";
    if (!mots.length || $("fStatut").value || $("fDept").value || cat) return;
    chargerIndexPages().then(function () {
      if ($("q").value.trim() !== q) return;
      var rubs = S.rubriques.filter(function (r) { return (!rubSel || r.titre === rubSel) && r._ntexte && mots.every(function (w) { return r._ntexte.indexOf(w) >= 0; }); });
      var docs = [];
      S.rubriques.forEach(function (r) {
        if (rubSel && r.titre !== rubSel) return;
        r.documents.forEach(function (d) { var h = norm((d.libelle || "") + " " + d.fichier + " " + (d.categorie || "")); if (mots.every(function (w) { return h.indexOf(w) >= 0; })) docs.push({ r: r, d: d }); });
      });
      compte(rubs.length, docs.length);
      if (!rubs.length && !docs.length) return;
      var h = '<div class="pages-box"><h3>📄 Dans le contenu des pages et les documents</h3>';
      h += rubs.map(function (r) { return '<a class="page-hit" href="#/r/' + slug(r.titre) + '"><b>' + icone(r.titre) + " " + esc(r.titre) + "</b><span>" + extrait(r._texte, r._ntexte, mots) + "</span></a>"; }).join("");
      if (docs.length) h += '<ul class="docs doc-hits">' + docs.map(function (x) { return docHtml(x.d).replace("</a></li>", ' <em>· ' + esc(x.r.titre) + "</em></a></li>"); }).join("") + "</ul>";
      $("pagesRes").innerHTML = h + "</div>";
    });
  }
  function remiseAZero() { $("q").value = ""; $("fStatut").value = ""; $("fDept").value = ""; $("fRub").value = ""; $("fType").value = ""; }
  function exporter() {
    var cols = ["rubrique", "nom", "_cat", "statut", "departement", "ville", "adresse", "contact", "telephone", "email", "site", "description"];
    var tete = ["Rubrique", "Nom", "Catégorie", "Statut juridique", "Département", "Ville", "Adresse", "Contact", "Téléphone", "Email", "Site", "Description"];
    var rows = [tete].concat(derniers.map(function (b) { return cols.map(function (c) { return c === "_cat" ? (b._cats || []).join(", ") : b[c] || ""; }); }));
    var csv = "﻿" + rows.map(function (r) { return r.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(";"); }).join("\r\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "recherche.csv"; document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------- navigation ---------- */
  function montrer(id) { ["viewLoading", "viewLocal", "viewHome", "viewSearch", "viewRub"].forEach(function (v) { $(v).hidden = v !== id; }); }
  function route() {
    var r = (location.hash || "#/accueil").replace(/^#\/?/, "") || "accueil";
    document.querySelectorAll("#nav a").forEach(function (a) { a.classList.toggle("active", a.getAttribute("data-route") === r); });
    fermerMenu();
    var site = S.reglages.titre;
    if (r === "recherche") { montrer("viewSearch"); $("pageTitle").textContent = "Rechercher"; document.title = "Rechercher – " + site; rechercher(); return; }
    if (r.indexOf("r/") === 0) {
      var rub = S.rubriques.filter(function (x) { return slug(x.titre) === r.slice(2); })[0];
      if (rub) { montrer("viewRub"); $("pageTitle").textContent = rub.titre; document.title = rub.titre + " – " + site; afficherRubrique(rub); return; }
    }
    montrer("viewHome"); $("pageTitle").textContent = "Accueil"; document.title = site + (S.reglages.soustitre ? " – " + S.reglages.soustitre : "");
  }
  function fermerMenu() { $("sidebar").classList.remove("open"); $("overlay").classList.remove("open"); }
  function remplir(sel, v) { v.forEach(function (x) { var o = document.createElement("option"); o.value = o.textContent = x; sel.appendChild(o); }); }

  /* ---------- démarrage ---------- */
  $("burger").onclick = function () { $("sidebar").classList.add("open"); $("overlay").classList.add("open"); };
  $("overlay").onclick = fermerMenu;
  if (location.protocol === "file:") { montrer("viewLocal"); return; }

  charger().then(function () {
    var R = S.reglages;
    $("brandTitle").textContent = R.titre;
    $("brandSub").textContent = R.soustitre || "";
    $("heroTitle").textContent = "Bienvenue sur le " + R.titre;
    $("heroText").textContent = R.accueil || "";
    afficherInfos();
    if (R.couleur) document.documentElement.style.setProperty("--primaire", R.couleur);
    var logos = R.logo ? [lien("", R.logo)] : LOGOS.map(function (f) { return "logo/" + f; });
    $("brandLogo").innerHTML = logoHtml({ nom: "♥", logos: logos }).replace('class="logo" alt', 'class="logo-site" alt');
    remplir($("fStatut"), uniq(S.blocs, "statut"));
    remplir($("fDept"), uniq(S.blocs, "departement"));
    remplir($("fRub"), S.rubriques.filter(function (r) { return r.blocs.length; }).map(function (r) { return r.titre; }));
    /* catégories : valeurs des champs déclarés en « Filtres » dans chaque rubrique */
    var groupes = {};
    S.rubriques.forEach(function (r) {
      r.blocs.forEach(function (b) {
        b._cats = [];
        r.filtres.forEach(function (f) { valeursChamp(b, f).forEach(function (v) { b._cats.push(v); (groupes[f] = groupes[f] || {})[v] = 1; }); });
      });
    });
    Object.keys(groupes).sort(trier).forEach(function (f) {
      var og = document.createElement("optgroup"); og.label = f;
      Object.keys(groupes[f]).sort(trier).forEach(function (v) { var o = document.createElement("option"); o.value = o.textContent = v; og.appendChild(o); });
      $("fType").appendChild(og);
    });
    var minuteur;
    $("q").addEventListener("input", function () { clearTimeout(minuteur); minuteur = setTimeout(rechercher, 150); });
    $("q").addEventListener("keydown", function (e) { if (e.key === "Escape") { $("q").value = ""; rechercher(); } });
    ["fStatut", "fDept", "fRub", "fType"].forEach(function (id) { $(id).addEventListener("change", rechercher); });
    $("reset").onclick = function () { remiseAZero(); rechercher(); };
    $("exportCsv").onclick = exporter;
    $("quickSearch").onsubmit = function (e) {
      e.preventDefault(); remiseAZero(); $("q").value = $("quickQ").value; $("quickQ").value = "";
      if (location.hash === "#/recherche") rechercher(); else location.hash = "#/recherche";
    };
    $("btnPdf").onclick = ouvrirOptionsPdf;
    $("btnLivretAccueil").onclick = function () { var btn = this; ouvrirOptionsLivret(function () { livretDepuisAccueil(btn); }); };
    construireMenu(); route();
    window.addEventListener("hashchange", route);
  }).catch(function () {
    montrer("viewLoading");
    $("viewLoading").innerHTML = '<div class="alerte">⚠️ Le fichier <code>menu.txt</code> est introuvable à la racine du site.</div>';
  });
})();
