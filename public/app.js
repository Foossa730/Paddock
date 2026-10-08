/* Paddock — interface du catalogue (vanilla JS, aucune dépendance) */
(() => {
  'use strict';

  const API = '/api/voitures';
  const PAR_PAGE = 12;

  const $ = (sel, el = document) => el.querySelector(sel);
  const nf = new Intl.NumberFormat('fr-FR');
  const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const eurosCourt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 });

  const etat = {
    page: 1,
    puissanceMax: 1,
    voitureOuverte: null,
    enEdition: null, // id de la voiture modifiée, null = création
  };

  // ---------- Utilitaires ----------
  const echapper = (v) =>
    String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ou = (v, format = (x) => x) => (v === null || v === undefined || v === '' ? '—' : format(v));
  const classeEnergie = (e) =>
    'e-' + String(e || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const get = (obj, chemin) => chemin.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

  async function appel(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    });
    if (res.status === 204) return null;
    const corps = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(corps.erreur || `Erreur ${res.status}`);
      err.status = res.status;
      err.details = corps.details;
      throw err;
    }
    return corps;
  }

  function toast(message, type = 'ok') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    $('#toasts').append(el);
    setTimeout(() => el.remove(), 3800);
  }

  // ---------- État de l'API ----------
  async function verifierApi() {
    const el = $('#etat-api');
    try {
      const r = await fetch('/health');
      const ok = r.ok;
      el.className = `etat ${ok ? 'ok' : 'ko'}`;
      $('.etat-texte', el).textContent = ok ? 'API connectée' : 'Base indisponible';
    } catch {
      el.className = 'etat ko';
      $('.etat-texte', el).textContent = 'API injoignable';
    }
  }

  // ---------- Statistiques ----------
  async function chargerStats() {
    const s = await appel(`${API}/stats`);
    const g = s.global || {};
    $('#kpi-total').textContent = nf.format(g.total || 0);
    $('#kpi-total-note').textContent = `${s.par_marque.length} marques`;
    $('#kpi-puissance').textContent = g.puissance_moyenne_ch ? nf.format(g.puissance_moyenne_ch) : '—';
    $('#kpi-prix').textContent = g.prix_moyen_eur ? eurosCourt.format(g.prix_moyen_eur) : '—';
    $('#kpi-vmax').textContent = g.vitesse_max_record_kmh ? nf.format(g.vitesse_max_record_kmh) : '—';

    dessinerBarres('#rep-energie', s.par_energie, 'energie', true);
    dessinerBarres('#rep-categorie', s.par_categorie, 'categorie', false);
  }

  function dessinerBarres(sel, lignes, filtre, couleurEnergie) {
    const max = Math.max(1, ...lignes.map((l) => l.nombre));
    const actif = $('#filtres').elements[filtre].value;
    $(sel).innerHTML = lignes
      .filter((l) => l.valeur)
      .map(
        (l) => `
        <div class="barre">
          <button type="button" data-filtre="${filtre}" data-valeur="${echapper(l.valeur)}"
            class="${actif === l.valeur ? 'actif' : ''}" title="Filtrer : ${echapper(l.valeur)}">${echapper(l.valeur)}</button>
          <div class="barre-piste"><div class="barre-remplie ${couleurEnergie ? classeEnergie(l.valeur) : ''}"
            style="width:${(l.nombre / max) * 100}%;${couleurEnergie ? 'background:currentColor' : ''}"></div></div>
          <span class="barre-nb">${l.nombre}</span>
        </div>`
      )
      .join('');
  }

  // ---------- Options des filtres (à partir de toutes les voitures) ----------
  async function chargerOptions() {
    let page = 1;
    let toutes = [];
    for (;;) {
      const r = await appel(`${API}?limite=100&page=${page}`);
      toutes = toutes.concat(r.data);
      if (page >= r.pages) break;
      page += 1;
    }
    etat.puissanceMax = Math.max(1, ...toutes.map((v) => get(v, 'moteur.puissance_ch') || 0));

    const uniques = (chemin) => [...new Set(toutes.map((v) => get(v, chemin)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
    remplirSelect('pays', uniques('pays'));
    remplirSelect('categorie', uniques('categorie'));
    remplirSelect('energie', uniques('moteur.energie'));
    $('#liste-pays').innerHTML = uniques('pays').map((p) => `<option value="${echapper(p)}">`).join('');
    $('#liste-categories').innerHTML = uniques('categorie').map((c) => `<option value="${echapper(c)}">`).join('');
  }

  function remplirSelect(nom, valeurs) {
    const select = $('#filtres').elements[nom];
    const courant = select.value;
    const premier = select.options[0].outerHTML;
    select.innerHTML = premier + valeurs.map((v) => `<option value="${echapper(v)}">${echapper(v)}</option>`).join('');
    if (valeurs.includes(courant)) select.value = courant;
  }

  // ---------- Catalogue ----------
  function parametres() {
    const f = $('#filtres').elements;
    const p = new URLSearchParams({ page: etat.page, limite: PAR_PAGE, tri: f.tri.value });
    for (const nom of ['q', 'pays', 'categorie', 'energie', 'puissance_min']) {
      const v = f[nom].value.trim();
      if (v) p.set(nom, v);
    }
    return p;
  }

  let requeteCourante = 0;
  async function chargerCatalogue() {
    const numero = ++requeteCourante;
    const grille = $('#grille');
    if (!grille.children.length) grille.innerHTML = '<div class="squelette"></div>'.repeat(6);
    try {
      const r = await appel(`${API}?${parametres()}`);
      if (numero !== requeteCourante) return; // une requête plus récente est partie
      if (r.data.length === 0 && etat.page > 1) {
        etat.page = r.pages || 1;
        return chargerCatalogue();
      }
      const debut = (r.page - 1) * r.limite + 1;
      $('#resume').textContent = r.total
        ? `${r.total} voiture${r.total > 1 ? 's' : ''} · ${debut}–${debut + r.data.length - 1} affichée${r.data.length > 1 ? 's' : ''}`
        : '';
      grille.innerHTML = r.data.length
        ? r.data.map(carte).join('')
        : '<p class="vide">Aucune voiture ne correspond à ces filtres.</p>';
      dessinerPagination(r.page, r.pages);
    } catch (e) {
      grille.innerHTML = `<p class="vide">Impossible de charger le catalogue : ${echapper(e.message)}</p>`;
      $('#pagination').innerHTML = '';
    }
  }

  function carte(v) {
    const m = v.moteur || {};
    const p = v.performances || {};
    const pct = Math.max(3, Math.round(((m.puissance_ch || 0) / etat.puissanceMax) * 100));
    return `
      <button type="button" class="carte" data-id="${echapper(v._id)}">
        <div class="carte-tete">
          <p class="carte-marque">${echapper(v.marque)} · ${echapper(v.annee)}</p>
          <h3 class="carte-modele">${echapper(v.modele)}</h3>
          <div class="badges">
            ${m.energie ? `<span class="badge energie ${classeEnergie(m.energie)}"><span class="badge-point"></span>${echapper(m.energie)}</span>` : ''}
            ${v.categorie ? `<span class="badge">${echapper(v.categorie)}</span>` : ''}
            ${v.en_production === false ? '<span class="badge arret">Plus produite</span>' : ''}
          </div>
        </div>
        <div class="carte-puissance">
          <div class="puissance-valeur"><strong>${ou(m.puissance_ch, nf.format)}</strong><span>ch</span></div>
          <div class="jauge" aria-hidden="true"><i style="width:${pct}%"></i></div>
        </div>
        <dl class="carte-specs">
          <div class="spec"><dt>0-100</dt><dd>${ou(p.zero_a_cent_s, (x) => `${String(x).replace('.', ',')} s`)}</dd></div>
          <div class="spec"><dt>V. max</dt><dd>${ou(p.vitesse_max_kmh, (x) => `${x} km/h`)}</dd></div>
          <div class="spec"><dt>Prix</dt><dd>${ou(v.prix_eur, (x) => eurosCourt.format(x))}</dd></div>
        </dl>
      </button>`;
  }

  function dessinerPagination(page, pages) {
    const nav = $('#pagination');
    if (pages <= 1) { nav.innerHTML = ''; return; }
    let html = `<button type="button" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''} aria-label="Page précédente">‹</button>`;
    for (let i = 1; i <= pages; i++) {
      html += `<button type="button" data-page="${i}" ${i === page ? 'aria-current="page"' : ''}>${i}</button>`;
    }
    html += `<button type="button" data-page="${page + 1}" ${page === pages ? 'disabled' : ''} aria-label="Page suivante">›</button>`;
    nav.innerHTML = html;
  }

  // ---------- Fiche détail ----------
  async function ouvrirDetail(id) {
    try {
      const v = await appel(`${API}/${encodeURIComponent(id)}`);
      etat.voitureOuverte = v;
      const m = v.moteur || {};
      const t = v.transmission || {};
      const p = v.performances || {};
      $('#detail-marque').textContent = `${v.marque} · ${v.annee}${v.pays ? ' · ' + v.pays : ''}`;
      $('#detail-modele').textContent = v.modele;
      const ligne = (label, val) => `<div><dt>${label}</dt><dd>${echapper(val)}</dd></div>`;
      $('#detail-corps').innerHTML = `
        <dl class="detail-hero">
          <div><dt>Puissance</dt><dd>${ou(m.puissance_ch, nf.format)}<small>ch</small></dd></div>
          <div><dt>0-100 km/h</dt><dd>${ou(p.zero_a_cent_s, (x) => String(x).replace('.', ','))}<small>s</small></dd></div>
          <div><dt>Vitesse max</dt><dd>${ou(p.vitesse_max_kmh)}<small>km/h</small></dd></div>
        </dl>
        <section class="detail-section">
          <h3>Moteur</h3>
          <dl class="detail-liste">
            ${ligne('Énergie', ou(m.energie))}
            ${ligne('Architecture', ou(m.architecture))}
            ${ligne('Cylindrée', ou(m.cylindree_cc, (x) => `${nf.format(x)} cm³`))}
            ${ligne('Couple', ou(m.couple_nm, (x) => `${nf.format(x)} Nm`))}
          </dl>
        </section>
        <section class="detail-section">
          <h3>Châssis &amp; transmission</h3>
          <dl class="detail-liste">
            ${ligne('Boîte', ou(t.boite))}
            ${ligne('Rapports', ou(t.rapports))}
            ${ligne('Transmission', ou(t.type))}
            ${ligne('Poids', ou(v.poids_kg, (x) => `${nf.format(x)} kg`))}
            ${ligne('Poids / puissance', ou(v.rapport_poids_puissance_kg_ch, (x) => `${String(x).replace('.', ',')} kg/ch`))}
            ${ligne('Places', ou(v.places))}
          </dl>
        </section>
        <section class="detail-section">
          <h3>Marché</h3>
          <dl class="detail-liste">
            ${ligne('Catégorie', ou(v.categorie))}
            ${ligne('Prix', ou(v.prix_eur, (x) => euros.format(x)))}
            ${ligne('Production', v.en_production === false ? 'Arrêtée' : 'En cours')}
          </dl>
        </section>`;
      reinitBoutonSupprimer();
      $('#dlg-detail').showModal();
    } catch (e) {
      toast(e.status === 404 ? 'Cette voiture n’existe plus.' : e.message, 'erreur');
      chargerTout();
    }
  }

  function reinitBoutonSupprimer() {
    const b = $('#btn-supprimer');
    b.dataset.confirmer = '';
    b.textContent = 'Supprimer';
  }

  async function supprimer() {
    const b = $('#btn-supprimer');
    if (!b.dataset.confirmer) {
      b.dataset.confirmer = '1';
      b.textContent = 'Confirmer la suppression';
      return;
    }
    const v = etat.voitureOuverte;
    b.disabled = true;
    try {
      await appel(`${API}/${v._id}`, { method: 'DELETE' });
      $('#dlg-detail').close();
      toast(`${v.marque} ${v.modele} supprimée`);
      chargerTout();
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      b.disabled = false;
      reinitBoutonSupprimer();
    }
  }

  // ---------- Formulaire ----------
  const form = () => $('#form-voiture');

  function ouvrirFormulaire(voiture) {
    const f = form();
    f.reset();
    $('#form-erreur').hidden = true;
    f.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
    etat.enEdition = voiture ? voiture._id : null;
    $('#form-titre').textContent = voiture ? `Modifier ${voiture.marque} ${voiture.modele}` : 'Ajouter une voiture';
    if (voiture) {
      for (const el of f.elements) {
        if (!el.name) continue;
        const val = get(voiture, el.name);
        if (el.type === 'checkbox') el.checked = val !== false;
        else el.value = val ?? '';
      }
    }
    $('#dlg-form').showModal();
    f.elements.marque.focus();
  }

  function lireFormulaire() {
    const corps = {};
    for (const el of form().elements) {
      if (!el.name) continue;
      let val;
      if (el.type === 'checkbox') val = el.checked;
      else if (el.value.trim() === '') continue;
      else if (el.type === 'number') val = Number(el.value);
      else val = el.value.trim();
      const cles = el.name.split('.');
      let cible = corps;
      while (cles.length > 1) {
        const k = cles.shift();
        cible = cible[k] = cible[k] || {};
      }
      cible[cles[0]] = val;
    }
    return corps;
  }

  async function enregistrer(ev) {
    ev.preventDefault();
    const f = form();
    const erreur = $('#form-erreur');
    erreur.hidden = true;
    f.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));

    const manquants = [...f.elements].filter((el) => el.required && !el.value.trim());
    if (manquants.length) {
      manquants.forEach((el) => el.setAttribute('aria-invalid', 'true'));
      erreur.textContent = 'Remplis les champs obligatoires (marqués d’une *).';
      erreur.hidden = false;
      manquants[0].focus();
      return;
    }

    const bouton = $('#btn-enregistrer');
    bouton.disabled = true;
    try {
      const corps = JSON.stringify(lireFormulaire());
      const v = etat.enEdition
        ? await appel(`${API}/${etat.enEdition}`, { method: 'PUT', body: corps })
        : await appel(API, { method: 'POST', body: corps });
      $('#dlg-form').close();
      toast(`${v.marque} ${v.modele} ${etat.enEdition ? 'modifiée' : 'ajoutée'}`);
      await chargerTout();
      if (etat.enEdition) ouvrirDetail(v._id);
    } catch (e) {
      let msg = e.message;
      if (e.details && typeof e.details === 'object' && !e.details.id) {
        msg += ' : ' + Object.values(e.details).join(' · ');
        for (const champ of Object.keys(e.details)) f.elements[champ]?.setAttribute('aria-invalid', 'true');
      }
      erreur.textContent = msg;
      erreur.hidden = false;
    } finally {
      bouton.disabled = false;
    }
  }

  // ---------- Chargement global ----------
  async function chargerTout() {
    await Promise.allSettled([chargerOptions().then(chargerCatalogue), chargerStats(), verifierApi()]);
  }

  // ---------- Événements ----------
  let minuterie;
  $('#filtres').addEventListener('input', (e) => {
    etat.page = 1;
    clearTimeout(minuterie);
    minuterie = setTimeout(() => { chargerCatalogue(); chargerStats(); }, e.target.name === 'q' ? 250 : 0);
  });
  $('#filtres').addEventListener('submit', (e) => e.preventDefault());
  $('#btn-reinit').addEventListener('click', () => {
    $('#filtres').reset();
    etat.page = 1;
    chargerCatalogue();
    chargerStats();
  });

  document.querySelector('.repartition').addEventListener('click', (e) => {
    const b = e.target.closest('[data-filtre]');
    if (!b) return;
    const select = $('#filtres').elements[b.dataset.filtre];
    select.value = select.value === b.dataset.valeur ? '' : b.dataset.valeur;
    etat.page = 1;
    chargerCatalogue();
    chargerStats();
  });

  $('#grille').addEventListener('click', (e) => {
    const c = e.target.closest('.carte');
    if (c) ouvrirDetail(c.dataset.id);
  });

  $('#pagination').addEventListener('click', (e) => {
    const b = e.target.closest('[data-page]');
    if (!b || b.disabled) return;
    etat.page = Number(b.dataset.page);
    chargerCatalogue();
    $('.catalogue').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  $('#btn-ajouter').addEventListener('click', () => ouvrirFormulaire(null));
  $('#btn-modifier').addEventListener('click', () => {
    $('#dlg-detail').close();
    ouvrirFormulaire(etat.voitureOuverte);
  });
  $('#btn-supprimer').addEventListener('click', supprimer);
  form().addEventListener('submit', enregistrer);

  document.querySelectorAll('dialog').forEach((dlg) => {
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg || e.target.closest('[data-fermer]')) dlg.close();
    });
  });

  setInterval(verifierApi, 15000);
  chargerTout();
})();
