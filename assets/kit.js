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
    var x = b.autres.filter(function (a) { return !champsBadges.some(function (c) { return cle(c) === cle(a[0]); }); }).map(function (a) { return "<b>" + esc(a[0]) + "</b> : " + liens(esc(a[1])).replace(/\n/g, "<br>"); });
    return '<article class="card"><div class="card-head">' + logoHtml(b) + "<div><h3>" + surligner(b.nom, q) + '</h3><div class="badges">' +
      (avecRubrique ? '<span class="badge type">' + esc(b.type || b.rubrique) + "</span>" : "") +
      champsBadges.map(function (c) { return valeursChamp(b, c).map(function (v) { return '<span class="badge filtre">' + esc(v) + "</span>"; }).join(""); }).join("") +
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
  var ICONES = [[/livret/i, "📘"], [/identif/i, "🏷️"], [/r[ôo]le|pr[ée]sentation/i, "🧭"], [/habilit|proc[eé]dure/i, "📋"], [/r[eé]f[eé]renc/i, "🏷️"], [/liste|annuaire|collectif|mss/i, "📍"], [/partenaire/i, "🤝"], [/financ/i, "💶"], [/contact/i, "☎️"], [/formation/i, "🎓"], [/actu/i, "📰"], [/agenda|calendrier|[eé]v[eé]nement/i, "📅"], [/document|ressource|outil/i, "📂"], [/faq|question/i, "❓"], [/club/i, "🏃"]];
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
    }).catch(function () { var box = $("rubPage"); if (!box) return; if (r.pageDeclaree) box.innerHTML = '<div class="alerte">⚠️ Fichier <b>' + esc(r.base + r.page) + "</b> introuvable.</div>"; else box.remove(); });

    if (r.blocs.length) {
      var rendu = function () {
        var res = filtrer(r.blocs, $("rq") ? $("rq").value : "", $("rs") ? $("rs").value : "", $("rd") ? $("rd").value : "", "", $("re") ? $("re").value : "");
        document.querySelectorAll("#viewRub select[data-champ]").forEach(function (sel) {
          if (sel.value) res = res.filter(function (b) { return valeursChamp(b, sel.getAttribute("data-champ")).indexOf(sel.value) >= 0; });
        });
        $("rc").textContent = r.blocs.length > 3 ? res.length + " sur " + r.blocs.length : "";
        $("rcards").innerHTML = res.length ? res.map(function (b) { return carte(b, "", false, r.filtres); }).join("") : '<div class="empty">Aucun résultat.</div>';
      };
      ["rq", "rs", "rd", "re"].forEach(function (id) { if ($(id)) $(id).addEventListener(id === "rq" ? "input" : "change", rendu); });
      document.querySelectorAll("#viewRub select[data-champ]").forEach(function (sel) { sel.addEventListener("change", rendu); });
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
      var fin = function () { document.title = ancien; $("print").innerHTML = ""; btn.disabled = false; btn.textContent = "📄 Générer le PDF"; window.removeEventListener("afterprint", fin); };
      window.addEventListener("afterprint", fin);
      setTimeout(function () { window.print(); }, 400);
    });
  }
  /* ---------- Contenus automatiques et livret PDF ---------- */
  function valeurAutre(b, cle0) { var a = b.autres.filter(function (x) { return cle(x[0]) === cle(cle0); })[0]; return a ? a[1] : ""; }
  function tableFinancements() {
    var rub = S.rubriques.filter(function (x) { return /financ/i.test(x.titre); })[0];
    var bl = rub ? rub.blocs.filter(function (b) { return !b.erreur; }) : [];
    if (!bl.length) return '<p class="vide-cat">Aucune fiche dans la rubrique Financements.</p>';
    return '<table class="lv-table"><tr><th>Émetteur</th><th>Dispositif</th><th>Montant</th></tr>' + bl.map(function (b) {
      return "<tr><td><b>" + esc(b.emetteur || "") + "</b></td><td>" + esc(b.nom) + "</td><td>" + esc(valeurAutre(b, "Montant") || "—") + "</td></tr>";
    }).join("") + "</table>";
  }
  function preparerContenu(box, r) {
    box.querySelectorAll('[data-auto="financements"]').forEach(function (x) { x.innerHTML = tableFinancements(); });
    var lv = box.querySelector("[data-livret]");
    if (!lv) return;
    var pages = lv.querySelectorAll(".livret-page");
    pages.forEach(function (p, i) { p.setAttribute("data-num", "Page " + (i + 1)); });
    var som = "<ol class=\"lv-sommaire\">";
    pages.forEach(function (p, i) { var t = p.getAttribute("data-titre"); if (t && i > 0) som += "<li><span>" + esc(t) + "</span><i></i><b>" + (i + 1) + "</b></li>"; });
    som += "</ol>";
    lv.querySelectorAll('[data-auto="sommaire"]').forEach(function (x) { x.innerHTML = som; });
    var barre = document.createElement("div");
    barre.className = "lv-barre";
    barre.innerHTML = '<button type="button" class="btn-primaire" id="btnLivret">📘 Générer le livret PDF</button><span>Couverture + ' + pages.length + " pages A4 · choisissez ensuite « Enregistrer au format PDF ».</span>";
    lv.parentNode.insertBefore(barre, lv);
    $("btnLivret").onclick = function () { genererLivret(r, lv, this); };
  }
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
        '<div class="lv-cover-pied"><b>' + esc(mention) + "</b><br>Édition " + annee + "</div></section>";
      var pages = lv.querySelectorAll(".livret-page");
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
      var fin = function () { document.title = ancien; $("print").innerHTML = ""; $("print").className = ""; btn.disabled = false; btn.textContent = "📘 Générer le livret PDF"; window.removeEventListener("afterprint", fin); };
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
    $("btnPdf").onclick = ouvrirOptionsPdf;
    construireMenu(); route();
    window.addEventListener("hashchange", route);
  }).catch(function () {
    montrer("viewLoading");
    $("viewLoading").innerHTML = '<div class="alerte">⚠️ Le fichier <code>menu.txt</code> est introuvable à la racine du site.</div>';
  });
})();
