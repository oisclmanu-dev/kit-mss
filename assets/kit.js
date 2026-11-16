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
      rub.pageDeclaree = !!cfg.val("Page");
      rub.page = cfg.val("Page") || "page.html";
      rub.carte = cfg.val("Carte", "Intégration", "Integration");
      rub.hauteurCarte = parseInt(cfg.val("Hauteur de la carte", "Hauteur carte"), 10) || 480;
      rub.documents = (cfg.listes.documents || []).map(function (d) {
        var p = d.split("|"), cible = (p[1] || p[0]).trim(), lib = p[1] ? p[0].trim() : "";
        return { libelle: lib, fichier: cible, url: lien(rub.base, cible) };
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
    var t = esc(text); if (!q) return t;
    var n = norm(t), out = "", i = 0, idx;
    while ((idx = n.indexOf(q, i)) >= 0) { out += t.slice(i, idx) + "<mark>" + t.slice(idx, idx + q.length) + "</mark>"; i = idx + q.length; }
    return out + t.slice(i);
  }
  function carte(b, q, avecRubrique) {
    if (b.erreur) return '<article class="card card-erreur"><h3>⚠️ ' + esc(b.dossier) + '</h3><p>Fichier <code>config.txt</code> introuvable dans le dossier <b>' + esc(b.base) + "</b>. Vérifiez que le nom du dossier correspond exactement à la ligne du fichier de la rubrique.</p></article>";
    var l = [];
    if (b.ville || b.adresse) l.push("📍 " + esc([b.adresse, b.ville].filter(Boolean).join(", ")));
    if (b.contact) l.push("👤 " + esc(b.contact));
    if (b.telephone) l.push("📞 " + esc(b.telephone).replace(/(?:\+33\s?|0)[1-9](?:[\s.]?\d{2}){4}/g, function (t) { return '<a href="tel:' + t.replace(/[\s.]/g, "") + '">' + t + "</a>"; }));
    if (b.email) l.push("✉️ " + String(b.email).split(/[;,\s]+/).filter(function (e) { return e.indexOf("@") > 0; }).map(function (e) { return '<a href="mailto:' + esc(e) + '">' + esc(e) + "</a>"; }).join(", "));
    if (b.site) l.push('🌐 <a href="' + esc(/^https?:/i.test(b.site) ? b.site : "https://" + b.site) + '" target="_blank" rel="noopener">' + esc(String(b.site).replace(/^https?:\/\//, "")) + "</a>");
    if (b.document) l.push('📄 <a href="' + esc(lien(b.base, b.document)) + '" target="_blank">' + esc(b.document.split("/").pop()) + "</a>");
    var x = b.autres.map(function (a) { return "<b>" + esc(a[0]) + "</b> : " + liens(esc(a[1])).replace(/\n/g, "<br>"); });
    return '<article class="card"><div class="card-head">' + logoHtml(b) + "<div><h3>" + surligner(b.nom, q) + '</h3><div class="badges">' +
      (avecRubrique ? '<span class="badge type">' + esc(b.type || b.rubrique) + "</span>" : "") +
      (b.emetteur ? '<span class="badge emetteur">🏛️ ' + esc(b.emetteur) + "</span>" : "") +
      (b.statut ? '<span class="badge">' + esc(b.statut) + "</span>" : "") +
      (b.departement ? '<span class="badge">' + esc(b.departement) + "</span>" : "") +
      "</div></div></div>" + (b.description ? "<p>" + surligner(b.description, q).replace(/\n/g, "<br>") + "</p>" : "") +
      (x.length ? '<div class="lines infos">' + x.join("<br>") + "</div>" : "") +
      (l.length ? '<div class="lines coords">' + l.join("<br>") + "</div>" : "") +
      (avecRubrique ? '<a class="voir" href="#/r/' + slug(b.rubrique) + '">Voir la rubrique « ' + esc(b.rubrique) + " » →</a>" : "") + "</article>";
  }
  function liens(t) { return t.replace(/https?:\/\/[^\s<]+[^\s<.,;)]/g, function (u) { return '<a href="' + u + '" target="_blank" rel="noopener">' + u.replace(/^https?:\/\//, "") + "</a>"; }); }
  function uniq(list, f) { var s = {}; list.forEach(function (d) { if (d[f]) s[String(d[f]).trim()] = 1; }); return Object.keys(s).sort(trier); }
  function filtrer(list, q, statut, dept, rub, emet) {
    var mots = norm(q).split(/\s+/).filter(Boolean);
    return list.filter(function (b) {
      if (b.erreur) return !mots.length && !statut && !dept;
      if (statut && String(b.statut || "").trim() !== statut) return false;
      if (dept && String(b.departement || "").trim() !== dept) return false;
      if (rub && b.rubrique !== rub) return false;
      if (emet && String(b.emetteur || "").trim() !== emet) return false;
      if (!mots.length) return true;
      var hay = norm([b.nom, b.emetteur, b.ville, b.adresse, b.contact, b.description, b.statut, b.departement, b.rubrique, b.type, b.email].concat(b.autres.map(function (a) { return a[0] + " " + a[1]; })).join(" "));
      return mots.every(function (w) { return hay.indexOf(w) >= 0; });
    });
  }

  /* ---------- menu & accueil ---------- */
  var ICONES = [[/habilit|proc[eé]dure/i, "📋"], [/r[eé]f[eé]renc/i, "🏷️"], [/liste|annuaire|collectif|mss/i, "📍"], [/partenaire/i, "🤝"], [/financ/i, "💶"], [/contact/i, "☎️"], [/formation/i, "🎓"], [/actu/i, "📰"], [/agenda|calendrier|[eé]v[eé]nement/i, "📅"], [/document|ressource|outil/i, "📂"], [/faq|question/i, "❓"], [/club/i, "🏃"]];
  function icone(n) { for (var i = 0; i < ICONES.length; i++) if (ICONES[i][0].test(n)) return ICONES[i][1]; return "📁"; }
  function construireMenu() {
    var h = '<a href="#/accueil" data-route="accueil"><span class="ico">🏠</span>Accueil</a>', t = "";
    S.rubriques.forEach(function (r) {
      var s = slug(r.titre);
      h += '<a href="#/r/' + s + '" data-route="r/' + s + '"><span class="ico">' + icone(r.titre) + "</span>" + esc(r.titre) + "</a>";
      t += '<a class="tile" href="#/r/' + s + '"><span class="ico">' + icone(r.titre) + '</span><span class="t">' + esc(r.titre) + "</span>" + (r.intro ? '<span class="d">' + esc(r.intro) + "</span>" : "") + "</a>";
    });
    h += '<div class="sep"></div><a href="#/recherche" data-route="recherche"><span class="ico">🔍</span>Rechercher</a>';
    t += '<a class="tile tile-search" href="#/recherche"><span class="ico">🔍</span><span class="t">Rechercher</span><span class="d">Toutes les structures, filtrées par statut juridique et département.</span></a>';
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
      if (r.blocs.length > 3 || st.length > 1 || dp.length > 1 || em.length > 1) {
        h += '<div class="rub-filtres"><input type="search" id="rq" placeholder="Filtrer…">' +
          (em.length > 1 ? '<select id="re"><option value="">Tous émetteurs</option>' + em.map(function (x) { return "<option>" + esc(x) + "</option>"; }).join("") + "</select>" : "") +
          (st.length > 1 ? '<select id="rs"><option value="">Tous statuts juridiques</option>' + st.map(function (x) { return "<option>" + esc(x) + "</option>"; }).join("") + "</select>" : "") +
          (dp.length > 1 ? '<select id="rd"><option value="">Tous départements</option>' + dp.map(function (x) { return "<option>" + esc(x) + "</option>"; }).join("") + "</select>" : "") + "</div>";
      }
      h += '<div class="result-count" id="rc"></div><div class="cards" id="rcards"></div>';
    }
    if (r.documents.length) {
      var groupes = {}, ordre = [];
      r.documents.forEach(function (d) {
        var parts = /^https?:/i.test(d.fichier) ? [d.fichier] : d.fichier.replace(/^documents\//i, "").split("/"), g = parts.length > 1 ? parts[0] : "";
        if (!(g in groupes)) { groupes[g] = []; ordre.push(g); }
        groupes[g].push(d);
      });
      h += '<h3 class="section">Documents</h3>';
      ordre.forEach(function (g) {
        if (g) h += '<h4 class="groupe">📁 ' + esc(g) + "</h4>";
        h += '<ul class="docs">' + groupes[g].map(docHtml).join("") + "</ul>";
      });
    }
    if (!r.pageDeclaree && !r.carte && !r.blocs.length && !r.documents.length && !r.erreur) h += '<div class="empty">Cette rubrique est encore vide.</div>';
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
    }).catch(function () { var box = $("rubPage"); if (!box) return; if (r.pageDeclaree) box.innerHTML = '<div class="alerte">⚠️ Fichier <b>' + esc(r.base + r.page) + "</b> introuvable.</div>"; else box.remove(); });

    if (r.blocs.length) {
      var rendu = function () {
        var res = filtrer(r.blocs, $("rq") ? $("rq").value : "", $("rs") ? $("rs").value : "", $("rd") ? $("rd").value : "", "", $("re") ? $("re").value : "");
        $("rc").textContent = r.blocs.length > 3 ? res.length + " sur " + r.blocs.length : "";
        $("rcards").innerHTML = res.length ? res.map(function (b) { return carte(b, "", false); }).join("") : '<div class="empty">Aucun résultat.</div>';
      };
      ["rq", "rs", "rd", "re"].forEach(function (id) { if ($(id)) $(id).addEventListener(id === "rq" ? "input" : "change", rendu); });
      rendu();
    }
  }
  /* Carte : pour uMap, désactive le zoom à la molette (évite de bloquer le défilement de la page) */
  function urlCarte(u) {
    if (!/umap\.openstreetmap/i.test(u) || /[?&]scrollWheelZoom=/.test(u)) return u;
    var i = u.indexOf("#"), base = i >= 0 ? u.slice(0, i) : u, hash = i >= 0 ? u.slice(i) : "";
    return base + (base.indexOf("?") >= 0 ? "&" : "?") + "scrollWheelZoom=false&fullscreenControl=true&captionBar=false" + hash;
  }
  var ICO = { pdf: "📕", doc: "📘", docx: "📘", odt: "📘", xls: "📗", xlsx: "📗", ods: "📗", csv: "📗", ppt: "📙", pptx: "📙", odp: "📙", png: "🖼️", jpg: "🖼️", jpeg: "🖼️", svg: "🖼️", mp4: "🎬", mp3: "🎧", zip: "🗜️" };
  function docHtml(d) {
    var nom = d.fichier.split("/").pop(), ext = /^https?:/i.test(d.fichier) ? "lien" : (nom.split(".").pop() || "").toLowerCase();
    var lib = d.libelle || (ext === "lien" ? d.fichier.replace(/^https?:\/\//i, "").replace(/\/$/, "") : nom.replace(/\.[^.]+$/, "").replace(/_+/g, " "));
    return '<li><a href="' + esc(d.url) + '" target="_blank" rel="noopener">' + (ext === "lien" ? "🔗" : ICO[ext] || "📄") + " " + esc(lib) + ' <small>' + esc(ext.toUpperCase()) + "</small></a></li>";
  }

  /* ---------- vue Recherche ---------- */
  var derniers = [];
  function rechercher() {
    var q = $("q").value.trim();
    derniers = filtrer(S.blocs, q, $("fStatut").value, $("fDept").value, $("fRub").value).sort(function (a, b) { return trier(a.nom, b.nom); });
    $("count").textContent = derniers.length + " résultat" + (derniers.length > 1 ? "s" : "") + " sur " + S.blocs.length;
    var hq = norm(q).split(/\s+/).filter(Boolean); hq = hq.length === 1 ? hq[0] : "";
    $("results").innerHTML = derniers.length ? derniers.map(function (b) { return carte(b, hq, true); }).join("") : '<div class="empty">Aucun résultat. Essayez d\'élargir les filtres.</div>';
  }
  function remiseAZero() { $("q").value = ""; $("fStatut").value = ""; $("fDept").value = ""; $("fRub").value = ""; }
  function exporter() {
    var cols = ["rubrique", "nom", "statut", "departement", "ville", "adresse", "contact", "telephone", "email", "site", "description"];
    var tete = ["Rubrique", "Nom", "Statut juridique", "Département", "Ville", "Adresse", "Contact", "Téléphone", "Email", "Site", "Description"];
    var rows = [tete].concat(derniers.map(function (b) { return cols.map(function (c) { return b[c] || ""; }); }));
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
    if (R.couleur) document.documentElement.style.setProperty("--primaire", R.couleur);
    var logos = R.logo ? [lien("", R.logo)] : LOGOS.map(function (f) { return "logo/" + f; });
    $("brandLogo").innerHTML = logoHtml({ nom: "♥", logos: logos }).replace('class="logo" alt', 'class="logo-site" alt');
    remplir($("fStatut"), uniq(S.blocs, "statut"));
    remplir($("fDept"), uniq(S.blocs, "departement"));
    remplir($("fRub"), S.rubriques.filter(function (r) { return r.blocs.length; }).map(function (r) { return r.titre; }));
    $("q").addEventListener("input", rechercher);
    ["fStatut", "fDept", "fRub"].forEach(function (id) { $(id).addEventListener("change", rechercher); });
    $("reset").onclick = function () { remiseAZero(); rechercher(); };
    $("exportCsv").onclick = exporter;
    $("quickSearch").onsubmit = function (e) {
      e.preventDefault(); remiseAZero(); $("q").value = $("quickQ").value; $("quickQ").value = "";
      if (location.hash === "#/recherche") rechercher(); else location.hash = "#/recherche";
    };
    construireMenu(); route();
    window.addEventListener("hashchange", route);
  }).catch(function () {
    montrer("viewLoading");
    $("viewLoading").innerHTML = '<div class="alerte">⚠️ Le fichier <code>menu.txt</code> est introuvable à la racine du site.</div>';
  });
})();
