// =====================================================================
// VIRGINIA EIRL · Panel de gestión
// Versión conectada a Supabase. El diseño y las pantallas son los de la
// maqueta original; lo que cambia es de dónde salen y adónde van los datos.
//
// Cómo funciona:
//   1. load() trae todo de Supabase y lo deja en S con la misma forma que
//      usaba la maqueta (S.c, S.p, S.q, S.o, S.f, S.g).
//   2. Las pantallas (vI, vQ, vO, vF, vG, vP, vC) leen S igual que antes.
//   3. Cada botón que guarda algo escribe en Supabase y luego llama a
//      load() + go() para refrescar.
// =====================================================================

const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
let S = { c: [], p: [], q: [], o: [], f: [], g: [] };
let USER = null;      // { id, nombre, rol }
let RUC = null;       // último resultado de la consulta RUC/DNI

// ---------- utilidades (igual que la maqueta) ----------
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fm = n => 'S/ ' + Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cn = id => (S.c.find(x => x.id == id) || {}).n || '—';
const pr = id => S.p.find(x => x.id == id) || { n: '(eliminado)', cost: 0, price: 0 };
const CATS = ['Industrial', 'Uso familiar', 'Merchandising', 'Embalaje'], ST = ['Borrador', 'Enviada', 'Aceptada', 'Perdida'];
const OC = ['Por comprar', 'Comprado', 'En fabricación', 'Recibido'], OE = ['Pendiente', 'En ruta', 'Entregado'];
const M = { Borrador: 0, Enviada: 1, Aceptada: 2, Perdida: 3, 'Por comprar': 0, Comprado: 1, 'En fabricación': 4, Recibido: 2, Pendiente: 0, 'En ruta': 1, Entregado: 2, 'Por pagar': 4, Pagado: 2 };
const bc = c => 'b b' + Math.max(0, CATS.indexOf(c));
const opts = (a, sel) => a.map(o => `<option ${o == sel ? 'selected' : ''}>${o}</option>`).join('');
const sel = (a, v, f) => `<select class="sel s${M[v]}" onchange="${f}">${opts(a, v)}</select>`;
let tab = 'i', sq = '', fl = 'todos', D = null, ex = 0;
// Costo: usa el costo guardado en el ítem (k); si no hay, el del catálogo.
const tot = it => { let s = 0, c = 0; it.forEach(i => { s += i.q * i.pr; c += i.q * (i.k ?? pr(i.p).cost) }); return { sub: s, igv: s * .18, tot: s * 1.18, mg: s ? (s - c) / s * 100 : 0 } };
const td = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10) }; // fecha local
const TABLA = { c: 'contactos', p: 'productos', q: 'cotizaciones', o: 'pedidos', f: 'comprobantes', g: 'gastos' };

// ---------- avisos y estado de carga ----------
function toast(m, err) {
  let t = $('toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t) }
  t.textContent = m; t.className = 'show' + (err ? ' err' : ''); clearTimeout(t._h); t._h = setTimeout(() => t.className = '', err ? 6000 : 2500);
}
const busy = on => document.body.classList.toggle('busy', !!on);
const ok = r => { if (r.error) throw r.error; return r.data };

// Ejecuta una escritura, recarga los datos y redibuja. Muestra errores.
async function run(fn, msg) {
  busy(true);
  try { await fn(); await load(); go(); if (msg) toast(msg) }
  catch (e) { console.error(e); toast('No se pudo guardar: ' + (e.message || e), 1) }
  finally { busy(false) }
}

// =====================================================================
// CARGA DE DATOS: Supabase → S (misma forma que la maqueta)
// =====================================================================
async function load() {
  const r = await Promise.all([
    sb.from('contactos').select('*').order('nombre'),
    sb.from('personas_contacto').select('*').order('id'),
    sb.from('productos').select('*').order('nombre'),
    sb.from('cotizaciones').select('*').order('id', { ascending: false }),
    sb.from('cotizacion_items').select('*').order('orden'),
    sb.from('pedidos').select('*').order('id', { ascending: false }),
    sb.from('comprobantes').select('*').order('id', { ascending: false }),
    sb.from('pagos').select('*').order('fecha'),
    sb.from('gastos').select('*').order('fecha', { ascending: false }),
  ]);
  const [c, pe, p, q, it, o, f, pg, g] = r.map(ok);

  S.c = c.map(x => ({
    id: x.id, n: x.nombre, t: x.tipo, d: x.documento || '', c: x.ciudad || '', p: x.telefono || '',
    es: x.estado_sunat, co: x.condicion_sunat,
    pe: pe.filter(y => y.contacto_id == x.id).map(y => ({ id: y.id, n: y.nombre, r: y.cargo || '', p: y.telefono || '', e: y.correo || '' }))
  }));
  S.p = p.map(x => ({ id: x.id, n: x.nombre, cat: x.categoria, pv: x.proveedor_id, cost: +x.costo, price: +x.precio }));
  S.q = q.map(x => ({
    id: x.id, num: x.numero, cl: x.cliente_id, d: x.fecha, st: x.estado,
    pe: (pe.find(y => y.id == x.persona_contacto_id) || {}).nombre || '',
    items: it.filter(i => i.cotizacion_id == x.id).map(i => ({ p: i.producto_id, n: i.descripcion, q: +i.cantidad, pr: +i.precio_unitario, k: +i.costo_unitario }))
  }));
  S.o = o.map(x => ({ id: x.id, q: x.cotizacion_id, pv: x.proveedor_id, dest: x.destino || '', ag: x.agencia || '', gu: x.guia || '', ec: x.estado_compra, ee: x.estado_envio }));
  S.f = f.filter(x => !x.anulado).map(x => ({
    id: x.id, tipo: x.tipo, num: x.serie + '-' + String(x.correlativo).padStart(6, '0'),
    q: x.cotizacion_id, cl: x.cliente_id, d: x.fecha_emision, v: x.fecha_vencimiento, total: +x.total,
    pg: pg.filter(y => y.comprobante_id == x.id).map(y => ({ d: y.fecha, m: +y.monto }))
  }));
  S.g = g.map(x => ({ id: x.id, d: x.fecha, c: x.concepto, cat: x.categoria, pv: x.proveedor_id, m: +x.monto, st: x.estado }));
}

// =====================================================================
// ESCRITURAS (antes modificaban S + localStorage; ahora van a Supabase)
// =====================================================================

// ---- Contactos ----
async function buscarDoc() {
  const d = $('cd').value.replace(/\D/g, '');
  if (!/^(\d{8}|\d{11})$/.test(d)) return toast('Escribe un RUC (11 dígitos) o DNI (8 dígitos)', 1);
  if (d.length == 11 && !rucOk(d)) return toast('Ese RUC no es válido, revisa los dígitos', 1);
  busy(true);
  try {
    const { data, error } = await sb.functions.invoke('consulta-ruc', { body: { numero: d } });
    if (error) throw error;
    if (data.error) throw new Error(data.error);
    RUC = data; $('cd').value = d; $('cn').value = data.nombre || '';
    if (data.ciudad) $('cc').value = data.ciudad;
    const alerta = data.tipo == 'RUC' && (data.estado != 'ACTIVO' || data.condicion != 'HABIDO');
    toast(data.tipo == 'RUC' ? `${data.estado} · ${data.condicion}` + (alerta ? ' ⚠ revisa antes de venderle' : ' ✓') : 'DNI encontrado ✓', alerta);
  } catch (e) { toast('No se pudo consultar: ' + (e.message || e), 1) }
  finally { busy(false) }
}

function addC() {
  const n = $('cn').value.trim(); if (!n) return;
  const d = $('cd').value.trim(), cx = $('cx').value.trim(), r = RUC && RUC.numero == d ? RUC : null;
  run(async () => {
    const c = ok(await sb.from('contactos').insert({
      nombre: n, tipo: $('ct').value, documento: d || null, ciudad: $('cc').value.trim(), telefono: $('cp').value.trim(),
      direccion: r ? r.direccion : null, estado_sunat: r ? r.estado : null, condicion_sunat: r ? r.condicion : null
    }).select().single());
    if (cx) ok(await sb.from('personas_contacto').insert({ contacto_id: c.id, nombre: cx }));
    RUC = null;
  }, 'Contacto agregado');
}
function addPe(id) {
  const n = $('xn').value.trim(); if (!n) return;
  run(async () => ok(await sb.from('personas_contacto').insert({ contacto_id: id, nombre: n, cargo: $('xr').value.trim(), telefono: $('xp').value.trim(), correo: $('xe').value.trim() })), 'Persona agregada');
}
function delPe(id, i) {
  const p = S.c.find(x => x.id == id).pe[i];
  run(async () => ok(await sb.from('personas_contacto').delete().eq('id', p.id)));
}

// ---- Catálogo ----
function addP() {
  const n = $('pn').value.trim(); if (!n) return;
  run(async () => ok(await sb.from('productos').insert({ nombre: n, categoria: $('pc').value, proveedor_id: +$('pv').value || null, costo: +$('pk').value || 0, precio: +$('pp').value || 0 })), 'Producto agregado');
}

// ---- Eliminar (cualquier sección) ----
function del(k, id) {
  if (!confirm('¿Eliminar este registro? No se puede deshacer.')) return;
  run(async () => ok(await sb.from(TABLA[k]).delete().eq('id', id)), 'Eliminado');
}

// ---- Cotizaciones ----
function newQ() { const c = S.c.find(x => x.t == 'cliente'); D = { cl: c ? c.id : 0, pe: '', items: [] }; go() }
function addL() { if (!S.p.length) return; const p = pr(+$('ep').value); D.items.push({ p: p.id, n: p.n, q: +$('eq').value || 1, pr: p.price, k: p.cost }); go() }
function updL(i, k, v) { D.items[i][k] = +v || 0; go() }
const items = (qid, arr) => arr.map((i, n) => ({ cotizacion_id: qid, producto_id: i.p || null, descripcion: i.n || pr(i.p).n, cantidad: i.q, precio_unitario: i.pr, costo_unitario: i.k ?? pr(i.p).cost, orden: n + 1 }));
function saveQ() {
  if (!D.cl || !D.items.length) return;
  const c = S.c.find(x => x.id == D.cl), pid = ((c && c.pe) || []).find(y => y.n == D.pe);
  run(async () => {
    const q = ok(await sb.from('cotizaciones').insert({ cliente_id: +D.cl, persona_contacto_id: pid ? pid.id : null, fecha: td(), estado: 'Borrador' }).select().single());
    ok(await sb.from('cotizacion_items').insert(items(q.id, D.items)));
    D = null;
  }, 'Cotización guardada');
}
function setSt(id, v) { run(async () => ok(await sb.from('cotizaciones').update({ estado: v }).eq('id', id))) }
function dup(id) {
  const o = S.q.find(x => x.id == id), c = S.c.find(x => x.id == o.cl), pid = ((c && c.pe) || []).find(y => y.n == o.pe);
  run(async () => {
    const q = ok(await sb.from('cotizaciones').insert({ cliente_id: o.cl, persona_contacto_id: pid ? pid.id : null, fecha: td(), estado: 'Borrador' }).select().single());
    ok(await sb.from('cotizacion_items').insert(items(q.id, o.items)));
  }, 'Cotización duplicada');
}

// ---- Pedidos y envíos ----
function addO() {
  const q = $('oq').value; if (!q) return;
  run(async () => ok(await sb.from('pedidos').insert({ cotizacion_id: +q, proveedor_id: +$('opv').value || null, destino: $('od').value.trim(), agencia: $('oa').value.trim() })), 'Pedido creado');
}
const COL_O = { gu: 'guia', ec: 'estado_compra', ee: 'estado_envio' };
function setO(id, k, v) { run(async () => ok(await sb.from('pedidos').update({ [COL_O[k]]: v }).eq('id', id))) }

// ---- Facturación ----
// El comprobante se emite en SUNAT (SEE-SOL); aquí se registra con la serie y número que dio SUNAT.
function serieDef() { $('fs').value = $('ft').value == 'Boleta' ? 'EB01' : 'E001' }
function addF() {
  const qid = +$('fq').value, serie = $('fs').value.trim().toUpperCase(), corr = +$('fn').value;
  if (!qid) return;
  if (!/^[A-Z0-9]{4}$/.test(serie) || !(corr > 0)) return toast('Ingresa la serie (ej. E001) y el número que te dio SUNAT', 1);
  const q = S.q.find(x => x.id == qid), t = tot(q.items), dias = +$('fd').value || 0;
  const v = new Date(new Date(td() + 'T12:00').getTime() + dias * 864e5).toISOString().slice(0, 10);
  run(async () => ok(await sb.from('comprobantes').insert({
    tipo: $('ft').value, serie, correlativo: corr, cotizacion_id: qid, cliente_id: q.cl,
    fecha_emision: td(), fecha_vencimiento: v,
    subtotal: +t.sub.toFixed(2), igv: +t.igv.toFixed(2), total: +t.tot.toFixed(2)
  })), 'Comprobante registrado');
}
function addPg(id) {
  const m = +$('pm' + id).value; if (!(m > 0)) return;
  run(async () => ok(await sb.from('pagos').insert({ comprobante_id: id, fecha: td(), monto: m })), 'Pago registrado');
}

// ---- Gastos ----
const GC = ['Compra a proveedor', 'Transporte', 'Servicios', 'Personal', 'Impuestos', 'Otros'];
function addG() {
  const m = +$('gm').value; if (!(m > 0) || !$('gc').value.trim()) return;
  run(async () => ok(await sb.from('gastos').insert({ fecha: $('gd').value || td(), concepto: $('gc').value.trim(), categoria: $('gk').value, proveedor_id: +$('gp').value || null, monto: m, estado: 'Pagado' })), 'Gasto agregado');
}
function setG(id, v) { run(async () => ok(await sb.from('gastos').update({ estado: v }).eq('id', id))) }

// =====================================================================
// PANTALLAS (iguales a la maqueta, con pequeños agregados marcados ★)
// =====================================================================
const pex = x => `<tr><td colspan="7" style="white-space:normal;background:var(--bg)"><b>Personas de contacto de ${esc(x.n)}</b>${(x.pe || []).map((p, i) => `<div class="row" style="padding:6px 0;align-items:center"><span>${esc(p.n)}</span><span class="mu">${esc(p.r)} ${esc(p.p)} ${esc(p.e)}</span><button class="g" onclick="delPe(${x.id},${i})" aria-label="Quitar">✕</button></div>`).join('') || '<div class="mu" style="padding:6px 0">Aún no hay personas de contacto.</div>'}<div class="row" style="margin-top:8px"><input id="xn" placeholder="Nombre"><input id="xr" placeholder="Cargo"><input id="xp" placeholder="Teléfono"><input id="xe" placeholder="Correo"><button class="s" onclick="addPe(${x.id})">Agregar persona</button></div></tr>`;

function vC() {
  const l = S.c.filter(x => fl == 'todos' || x.t == fl);
  // ★ botón "Buscar en SUNAT" junto al RUC/DNI, y alerta si el RUC no está ACTIVO/HABIDO
  const sunat = x => x.es && (x.es != 'ACTIVO' || x.co != 'HABIDO') ? ` <span class="b b5">${esc(x.es)} · ${esc(x.co)}</span>` : '';
  return `<h2>Contactos</h2>
<div class="card"><div class="row"><input id="cd" placeholder="RUC o DNI" inputmode="numeric" onkeydown="if(event.key=='Enter')buscarDoc()"><button class="s" onclick="buscarDoc()">🔍 Buscar en SUNAT</button><input id="cn" placeholder="Nombre o razón social"><select id="ct"><option>cliente<option>proveedor</select><input id="cc" placeholder="Ciudad"><input id="cp" placeholder="Teléfono"><input id="cx" placeholder="Persona de contacto"><button onclick="addC()">Agregar contacto</button></div></div>
<div class="row" style="margin-bottom:10px"><select onchange="fl=this.value;go()">${opts(['todos', 'cliente', 'proveedor'], fl)}</select></div>
<div class="card sc"><table><tr><th>Nombre<th>Tipo<th>RUC / DNI<th>Ciudad<th>Teléfono<th>Personas de contacto<th></tr>${l.map(x => `<tr><td>${esc(x.n)}${sunat(x)}<td>${x.t}<td>${esc(x.d)} <span class="${/inv|\?/.test(docV(x.d)) ? 'b b5' : 'mu'}">${docV(x.d)}</span><td>${esc(x.c)}<td>${esc(x.p)}<td>${(x.pe || []).map(q => esc(q.n)).join(', ') || '<span class="mu">Sin contacto</span>'} <button class="g" onclick="ex=ex==${x.id}?0:${x.id};go()">${ex == x.id ? 'Cerrar' : 'Gestionar'}</button><td><button class="g" onclick="del('c',${x.id})" aria-label="Eliminar">✕</button></tr>${ex == x.id ? pex(x) : ''}`).join('') || '<tr><td colspan="7" class="mu">Aún no hay contactos. Agrega el primero arriba.</tr>'}</table></div>`
}

function vP() {
  const pv = S.c.filter(x => x.t == 'proveedor');
  return `<h2>Catálogo</h2>
<div class="card"><div class="row"><input id="pn" placeholder="Producto"><select id="pc">${opts(CATS)}</select><select id="pv"><option value="">Sin proveedor</option>${pv.map(x => `<option value="${x.id}">${esc(x.n)}</option>`).join('')}</select><input id="pk" type="number" step="0.01" placeholder="Costo S/" style="width:100px"><input id="pp" type="number" step="0.01" placeholder="Precio S/" style="width:100px"><button onclick="addP()">Agregar producto</button></div></div>
<div class="card sc"><table><tr><th>Producto<th>Categoría<th>Proveedor<th class="r">Costo<th class="r">Precio<th class="r">Margen<th></tr>${S.p.map(x => `<tr><td>${esc(x.n)}<td><span class="${bc(x.cat)}">${x.cat}</span><td>${esc(cn(x.pv))}<td class="r">${fm(x.cost)}<td class="r">${fm(x.price)}<td class="r">${x.price ? ((x.price - x.cost) / x.price * 100).toFixed(1) : 0}%<td><button class="g" onclick="del('p',${x.id})" aria-label="Eliminar">✕</button></tr>`).join('') || '<tr><td colspan="7" class="mu">Aún no hay productos. Agrega el primero arriba.</tr>'}</table></div>`
}

function vE() {
  const t = tot(D.items), cl = S.c.filter(x => x.t == 'cliente');
  return `<h2>Nueva cotización</h2>
<div class="card"><div class="row"><select onchange="D.cl=this.value;D.pe='';go()">${cl.map(x => `<option value="${x.id}" ${x.id == D.cl ? 'selected' : ''}>${esc(x.n)}</option>`).join('')}</select><select onchange="D.pe=this.value"><option value="">Sin persona de contacto</option>${((S.c.find(x => x.id == D.cl) || {}).pe || []).map(q => `<option ${q.n == D.pe ? 'selected' : ''}>${esc(q.n)}</option>`).join('')}</select><select id="ep">${S.p.map(x => `<option value="${x.id}">${esc(x.n)} · ${fm(x.price)}</option>`).join('')}</select><input id="eq" type="number" min="1" value="1" style="width:80px"><button class="s" onclick="addL()">Agregar producto</button></div></div>
<div class="card sc"><table><tr><th>Producto<th class="r">Cantidad<th class="r">Precio unit.<th class="r">Subtotal<th></tr>${D.items.map((i, n) => `<tr><td>${esc(i.n || pr(i.p).n)}<td class="r"><input type="number" min="1" value="${i.q}" style="width:80px" onchange="updL(${n},'q',this.value)"><td class="r"><input type="number" step="0.01" value="${i.pr}" style="width:90px" onchange="updL(${n},'pr',this.value)"><td class="r">${fm(i.q * i.pr)}<td><button class="g" onclick="D.items.splice(${n},1);go()" aria-label="Quitar">✕</button></tr>`).join('') || '<tr><td colspan="5" class="mu">Agrega productos para armar la cotización.</tr>'}</table>
<p class="r" style="text-align:right;margin:12px 0 0">Subtotal ${fm(t.sub)} · IGV 18% ${fm(t.igv)} · <b>Total ${fm(t.tot)}</b><br><span class="${t.mg < 15 && t.sub ? 'lo' : 'mu'}">Margen ${t.mg.toFixed(1)}%${t.mg < 15 && t.sub ? ' · bajo, revisa los precios' : ''}</span></p></div>
<div class="row"><button onclick="saveQ()">Guardar cotización</button><button class="s" onclick="D=null;go()">Cancelar</button></div>`
}

function vQ() {
  if (D) return vE();
  const ab = S.q.filter(x => x.st == 'Enviada').length, ac = S.q.filter(x => x.st == 'Aceptada').reduce((a, x) => a + tot(x.items).tot, 0);
  return `<h2>Cotizaciones</h2>
<div class="stats"><div class="k0"><b>${ab}</b><span>Enviadas, esperando respuesta</span></div><div class="k1"><b>${fm(ac)}</b><span>Total aceptado (con IGV)</span></div><div class="k2"><b>${S.q.length}</b><span>Cotizaciones en total</span></div></div>
<div class="row" style="margin-bottom:10px"><button onclick="newQ()">Nueva cotización</button></div>
<div class="card sc"><table><tr><th>N°<th>Cliente<th>Fecha<th class="r">Total<th class="r">Margen<th>Estado<th></tr>${S.q.map(x => { const t = tot(x.items); return `<tr><td>${x.num}<td>${esc(cn(x.cl))}${x.pe ? `<br><span class="mu">Contacto: ${esc(x.pe)}</span>` : ''}<td>${x.d}<td class="r">${fm(t.tot)}<td class="r ${t.mg < 15 ? 'lo' : ''}">${t.mg.toFixed(1)}%${t.mg < 15 ? ' ⚠' : ''}<td>${sel(ST, x.st, `setSt(${x.id},this.value)`)}<td>${wa(x)}<button class="g" onclick="dup(${x.id})" aria-label="Duplicar" title="Duplicar">⧉</button><button class="g" onclick="del('q',${x.id})" aria-label="Eliminar">✕</button></tr>` }).join('') || '<tr><td colspan="7" class="mu">Aún no hay cotizaciones. Crea la primera.</tr>'}</table></div>`
}

// Estado de cada comprobante (el total ahora viene guardado en el comprobante)
const fi = f => {
  const q = S.q.find(y => y.id == f.q), t = f.total, p = f.pg.reduce((a, x) => a + x.m, 0), s = t - p;
  const e = s <= .005 ? 'Pagada' : f.v < td() ? 'Vencida' : p > 0 ? 'Parcial' : 'Pendiente'; return { q, t, p, s, e }
};
const FB = { Pendiente: 'b0', Parcial: 'b2', Pagada: 'b4', Vencida: 'b5' };

function vF() {
  const used = S.f.map(x => x.q), aq = S.q.filter(x => x.st == 'Aceptada' && !used.includes(x.id)), L = S.f.map(f => ({ f, ...fi(f) }));
  const pc = L.reduce((a, x) => a + x.s, 0), ve = L.filter(x => x.e == 'Vencida').reduce((a, x) => a + x.s, 0), mes = td().slice(0, 7), co = S.f.reduce((a, f) => a + f.pg.filter(x => x.d.startsWith(mes)).reduce((b, x) => b + x.m, 0), 0);
  // ★ registro con tipo, serie y número reales de SUNAT + acceso directo a SUNAT SOL
  return `<h2>Facturación y cobranzas</h2>
<div class="stats"><div class="k0"><b>${fm(pc)}</b><span>Por cobrar</span></div><div class="k3"><b>${fm(ve)}</b><span>Vencido</span></div><div class="k1"><b>${fm(co)}</b><span>Cobrado este mes</span></div></div>
<div class="card"><div class="row"><select id="fq">${aq.map(x => `<option value="${x.id}">${x.num} · ${esc(cn(x.cl))} · ${fm(tot(x.items).tot)}</option>`).join('') || '<option value="">Sin cotizaciones aceptadas por facturar</option>'}</select><select id="ft" onchange="serieDef()"><option>Factura<option>Boleta</select><input id="fs" value="E001" placeholder="Serie" style="width:80px" aria-label="Serie"><input id="fn" type="number" min="1" placeholder="N° SUNAT" style="width:100px" aria-label="Número"><input id="fd" type="number" min="0" value="30" style="width:80px" aria-label="Días de crédito"><span class="mu" style="align-self:center">días de crédito</span><button onclick="addF()">Registrar comprobante</button></div>
<div class="mu" style="margin-top:8px">1) Emite el comprobante en <a href="https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm" target="_blank" rel="noopener">SUNAT SOL ↗</a> · 2) Copia aquí la serie y el número que te dio SUNAT · 3) Registra.</div></div>
<div class="card sc"><table><tr><th>Comprobante<th>Cliente<th>Emisión<th>Vence<th class="r">Total<th class="r">Pagado<th class="r">Saldo<th>Estado<th>Registrar pago<th></tr>${L.map(({ f, q, t, p, s, e }) => `<tr><td>${f.num}<br><span class="mu">${f.tipo}${q ? ' · ' + q.num : ''}</span><td>${esc(cn(f.cl || (q && q.cl)))}<td>${f.d}<td>${f.v}<td class="r">${fm(t)}<td class="r">${fm(p)}<td class="r">${fm(s)}<td><span class="b ${FB[e]}">${e}</span><td>${s > .005 ? `<input id="pm${f.id}" type="number" step="0.01" min="0" placeholder="Monto S/" style="width:100px"> <button class="s" onclick="addPg(${f.id})">Pagar</button>` : '<span class="mu">Cobrada</span>'}<td><button class="g" onclick="del('f',${f.id})" aria-label="Eliminar">✕</button></tr>`).join('') || '<tr><td colspan="10" class="mu">Aún no hay comprobantes. Registra el primero desde una cotización aceptada.</tr>'}</table></div>`
}

function vG() {
  const mk = Array.from({ length: 6 }, (_, i) => { const n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() - 5 + i, 1)).toISOString().slice(0, 7) });
  const ing = k => S.f.reduce((a, f) => a + f.pg.filter(x => x.d.startsWith(k)).reduce((b, x) => b + x.m, 0), 0), gas = k => S.g.filter(x => x.st == 'Pagado' && x.d.startsWith(k)).reduce((a, x) => a + x.m, 0);
  const mx = Math.max(1, ...mk.map(k => Math.max(ing(k), gas(k)))), mes = mk[5], xp = S.g.filter(x => x.st == 'Por pagar').reduce((a, x) => a + x.m, 0);
  const bar = (v, c) => `<div style="height:7px;border-radius:4px;background:${c};width:${v / mx * 100}%;margin:2px 0"></div>`;
  return `<h2>Finanzas</h2>
<div class="stats"><div class="k1"><b>${fm(ing(mes))}</b><span>Cobrado este mes</span></div><div class="k3"><b>${fm(gas(mes))}</b><span>Gastos pagados este mes</span></div><div class="k0"><b>${fm(ing(mes) - gas(mes))}</b><span>Flujo neto del mes</span></div><div class="k2"><b>${fm(xp)}</b><span>Por pagar</span></div></div>
<div class="card sc"><table><tr><th>Mes<th class="r">Cobrado<th class="r">Gastos<th class="r">Neto<th style="min-width:160px">Comparación</tr>${mk.map(k => `<tr><td>${k}<td class="r">${fm(ing(k))}<td class="r">${fm(gas(k))}<td class="r">${fm(ing(k) - gas(k))}<td>${bar(ing(k), '#16a34a')}${bar(gas(k), '#dc2626')}</tr>`).join('')}</table><div class="mu" style="margin-top:8px">Verde: cobrado. Rojo: gastos pagados.</div></div>
<h2 style="font-size:19px">Gastos</h2>
<div class="card"><div class="row"><input id="gd" type="date" value="${td()}"><input id="gc" placeholder="Concepto"><select id="gk">${opts(GC)}</select><select id="gp"><option value="0">Sin proveedor</option>${S.c.filter(x => x.t == 'proveedor').map(x => `<option value="${x.id}">${esc(x.n)}</option>`).join('')}</select><input id="gm" type="number" step="0.01" min="0" placeholder="Monto S/" style="width:110px"><button onclick="addG()">Agregar gasto</button></div></div>
<div class="card sc"><table><tr><th>Fecha<th>Concepto<th>Categoría<th>Proveedor<th class="r">Monto<th>Estado<th></tr>${S.g.map(x => `<tr><td>${x.d}<td>${esc(x.c)}<td>${esc(x.cat)}<td>${x.pv ? esc(cn(x.pv)) : '<span class="mu">—</span>'}<td class="r">${fm(x.m)}<td>${sel(['Por pagar', 'Pagado'], x.st, `setG(${x.id},this.value)`)}<td><button class="g" onclick="del('g',${x.id})" aria-label="Eliminar">✕</button></tr>`).join('') || '<tr><td colspan="7" class="mu">Aún no hay gastos. Registra el primero arriba.</tr>'}</table></div>`
}

const rucOk = d => { if (!/^(10|15|17|20)\d{9}$/.test(d)) return false; const w = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]; let t = 0; for (let i = 0; i < 10; i++)t += w[i] * +d[i]; return (11 - t % 11) % 10 == +d[10] };
const docV = d => !d ? '' : d.length == 11 ? (rucOk(d) ? 'RUC ✓' : 'RUC inválido') : d.length == 8 ? 'DNI' : 'Documento ?';
function wa(x) {
  const c = S.c.find(y => y.id == x.cl); if (!c) return ''; const p = (c.pe || []).find(y => y.n == x.pe), raw = ((p && p.p) || c.p || '').replace(/\D/g, ''); if (raw.length < 9) return ''; const n = raw.length == 9 ? '51' + raw : raw;
  const m = `Hola${x.pe ? ' ' + x.pe.split(' ')[0] : ''}, le saludamos de VIRGINIA EIRL. Le enviamos la cotización ${x.num} por ${fm(tot(x.items).tot)} (incluye IGV). Quedamos atentos a su confirmación.`;
  return `<a class="wa" href="https://wa.me/${n}?text=${encodeURIComponent(m)}" target="_blank" rel="noopener">WhatsApp</a>`
}
function flt() { const v = sq.toLowerCase(); document.querySelectorAll('#app table tr').forEach(r => { if (r.querySelector('th')) return; r.style.display = !v || r.textContent.toLowerCase().includes(v) ? '' : 'none' }) }

function vI() {
  const h = new Date().getHours(), sal = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches', fe = new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
  const L = S.f.map(f => ({ f, ...fi(f) })), hoy = td(), mes = hoy.slice(0, 7), dd = x => Math.floor((Date.now() - new Date(x)) / 864e5), pl = (n, a, b) => n + ' ' + (n == 1 ? a : b);
  const pc = L.reduce((a, x) => a + x.s, 0), ve = L.filter(x => x.e == 'Vencida'), pv = L.filter(x => x.s > .005 && x.f.v >= hoy && (new Date(x.f.v) - Date.now()) / 864e5 <= 7);
  const ab = S.q.filter(x => x.st == 'Enviada'), seg = ab.filter(x => dd(x.d) > 5), bajo = S.q.filter(x => ['Borrador', 'Enviada'].includes(x.st) && tot(x.items).mg < 15);
  const co = S.f.reduce((a, f) => a + f.pg.filter(x => x.d.startsWith(mes)).reduce((b, x) => b + x.m, 0), 0), ga = S.g.filter(x => x.st == 'Pagado' && x.d.startsWith(mes)).reduce((a, x) => a + x.m, 0);
  const npc = S.o.filter(x => x.ec == 'Por comprar').length, ner = S.o.filter(x => x.ee == 'En ruta').length, ngp = S.g.filter(x => x.st == 'Por pagar').length;
  const A = [[ve.length, '🔴', `${pl(ve.length, 'factura vencida', 'facturas vencidas')} por ${fm(ve.reduce((a, x) => a + x.s, 0))}`, 'f'], [pv.length, '🟡', `${pl(pv.length, 'factura vence', 'facturas vencen')} en los próximos 7 días`, 'f'], [seg.length, '📞', `${pl(seg.length, 'cotización enviada espera', 'cotizaciones enviadas esperan')} respuesta hace más de 5 días (${seg.map(x => x.num).join(', ')})`, 'q'], [bajo.length, '⚠️', `${pl(bajo.length, 'cotización abierta tiene', 'cotizaciones abiertas tienen')} margen menor a 15%`, 'q'], [npc, '🛒', `${pl(npc, 'pedido por comprar', 'pedidos por comprar')} al proveedor`, 'o'], [ner, '🚚', `${pl(ner, 'envío en ruta', 'envíos en ruta')}`, 'o'], [ngp, '💸', `${pl(ngp, 'gasto por pagar', 'gastos por pagar')}`, 'g']].filter(a => a[0]);
  const tc = {}, tp = {}; S.q.filter(x => x.st == 'Aceptada').forEach(q => { tc[q.cl] = (tc[q.cl] || 0) + tot(q.items).tot; q.items.forEach(i => { const k = i.n || pr(i.p).n; tp[k] = (tp[k] || 0) + i.q }) });
  const rk = (o, nf, vf) => { const e = Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 5), m = e.length ? e[0][1] : 1; return e.map(([k, v]) => `<div class="rk"><i style="width:${v / m * 100}%"></i><span>${esc(nf(k))}</span><b>${vf(v)}</b></div>`).join('') || '<div class="mu">Aún sin ventas aceptadas.</div>' };
  return `<div class="hero"><div><small>${fe}</small><h2>${sal}, ${esc(USER ? USER.nombre : 'equipo de VIRGINIA EIRL')}</h2><p>Esto es lo más importante para hoy.</p></div><div class="hs"><b>${fm(pc)}</b><span>por cobrar</span></div></div>
<div class="stats"><div class="k3"><em>🔴</em><b>${fm(ve.reduce((a, x) => a + x.s, 0))}</b><span>Cobranza vencida</span></div><div class="k0"><em>📨</em><b>${ab.length}</b><span>Cotizaciones esperando respuesta</span></div><div class="k1"><em>💰</em><b>${fm(co - ga)}</b><span>Flujo neto del mes</span></div></div>
<div class="card"><h3>Para atender hoy</h3>${A.map(a => `<div class="al" onclick="tab='${a[3]}';sq='';go()"><span>${a[1]}</span>${a[2]}<em>›</em></div>`).join('') || '<div class="mu">Todo al día ✔</div>'}</div>
<div class="g2"><div class="card"><h3>Mejores clientes</h3>${rk(tc, k => cn(k), fm)}</div><div class="card"><h3>Productos más vendidos</h3>${rk(tp, k => k, v => v + ' u.')}</div></div>`
}

function vO() {
  const aq = S.q.filter(x => x.st == 'Aceptada'), pv = S.c.filter(x => x.t == 'proveedor');
  return `<h2>Pedidos y envíos</h2>
<div class="card"><div class="row"><select id="oq">${aq.map(x => `<option value="${x.id}">${x.num} · ${esc(cn(x.cl))}</option>`).join('') || '<option value="">Sin cotizaciones aceptadas</option>'}</select><select id="opv">${pv.map(x => `<option value="${x.id}">${esc(x.n)}</option>`).join('')}</select><input id="od" placeholder="Destino (ciudad)"><input id="oa" placeholder="Agencia de transporte"><button onclick="addO()">Crear pedido</button></div></div>
<div class="card sc"><table><tr><th>Cotización<th>Proveedor<th>Destino<th>Agencia<th>Guía<th>Compra<th>Envío<th></tr>${S.o.map(x => { const q = S.q.find(y => y.id == x.q); return `<tr><td>${q ? q.num : '—'}<br><span class="mu">${q ? esc(cn(q.cl)) : ''}</span><td>${esc(cn(x.pv))}<td>${esc(x.dest)}<td>${esc(x.ag)}<td><input value="${esc(x.gu)}" placeholder="N° de guía" style="width:120px" onchange="setO(${x.id},'gu',this.value)"><td>${sel(OC, x.ec, `setO(${x.id},'ec',this.value)`)}<td>${sel(OE, x.ee, `setO(${x.id},'ee',this.value)`)}<td><button class="g" onclick="del('o',${x.id})" aria-label="Eliminar">✕</button></tr>` }).join('') || '<tr><td colspan="8" class="mu">Aún no hay pedidos. Crea uno desde una cotización aceptada.</tr>'}</table></div>`
}

function go() {
  $('nav').style.display = '';
  $('nav').innerHTML = '<h1><span class="lg">V</span><div>VIRGINIA EIRL<small>Panel de gestión</small></div></h1>' + [['i', '🏠 Inicio'], ['q', '📋 Cotizaciones'], ['o', '🚚 Pedidos y envíos'], ['f', '🧾 Facturación'], ['g', '💰 Finanzas'], ['p', '📦 Catálogo'], ['c', '👥 Contactos']].map(([k, l]) => `<button class="${tab == k ? 'on' : ''}" onclick="tab='${k}';D=null;sq='';go()">${l}</button>`).join('')
    + `<button class="out" onclick="salir()">↩ Salir${USER ? ' · ' + esc(USER.nombre) : ''}</button>`; // ★
  const v = tab == 'i' ? vI() : tab == 'g' ? vG() : tab == 'f' ? vF() : tab == 'o' ? vO() : tab == 'c' ? vC() : tab == 'p' ? vP() : vQ();
  $('app').innerHTML = (tab == 'i' ? '' : `<div class="top"><input class="srch" placeholder="🔍 Buscar en esta sección…" value="${esc(sq)}" oninput="sq=this.value;flt()" aria-label="Buscar"></div>`) + v; flt()
}

// =====================================================================
// ★ LOGIN
// =====================================================================
function vLogin(msg) {
  $('nav').style.display = 'none';
  $('app').innerHTML = `<div class="login card"><div class="lg">V</div><h2>VIRGINIA EIRL</h2><p class="mu">Panel de gestión · ingresa con tu correo</p>
<input id="le" type="email" placeholder="Correo" autocomplete="username"><input id="lp" type="password" placeholder="Contraseña" autocomplete="current-password" onkeydown="if(event.key=='Enter')login()">
<button onclick="login()">Entrar</button>${msg ? `<p class="lo">${esc(msg)}</p>` : ''}</div>`;
}
async function login() {
  const email = $('le').value.trim();
  if (/TU-PROYECTO|PEGA_AQUI/.test(window.SUPABASE_URL + window.SUPABASE_ANON_KEY))
    return vLogin('Falta poner la URL y la llave de Supabase en js/config.js');
  busy(true);
  let error;
  try { ({ error } = await sb.auth.signInWithPassword({ email, password: $('lp').value })) }
  catch (e) { error = e }
  busy(false);
  if (error) {
    const m = String(error.message || error);
    const msg = /invalid login credentials/i.test(m) ? 'Correo o contraseña incorrectos'
      : /email not confirmed/i.test(m) ? 'Este correo no está confirmado. En Supabase → Authentication → Users, confírmalo o vuelve a crearlo con "Auto confirm user".'
      : /fetch|network|failed to/i.test(m) ? 'No se pudo conectar con Supabase. Revisa la URL en js/config.js y tu internet.'
      : /api key|apikey|jwt/i.test(m) ? 'La llave de Supabase en js/config.js no es válida. Copia de nuevo la anon/publishable key.'
      : 'No se pudo entrar: ' + m;
    vLogin(msg); $('le').value = email; return;
  }
  start();
}
async function salir() { await sb.auth.signOut(); USER = null; S = { c: [], p: [], q: [], o: [], f: [], g: [] }; tab = 'i'; vLogin() }

async function start() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return vLogin();
  busy(true);
  try {
    const p = ok(await sb.from('perfiles').select('nombre,rol').eq('id', session.user.id).maybeSingle());
    if (!p) { await sb.auth.signOut(); return vLogin('Tu usuario aún no tiene acceso. Pide a Dani que te agregue.') }
    USER = { id: session.user.id, ...p };
    await load(); go();
  } catch (e) { console.error(e); vLogin('No se pudo conectar: ' + (e.message || e)) }
  finally { busy(false) }
}
sb.auth.onAuthStateChange(ev => { if (ev == 'SIGNED_OUT' && USER) { USER = null; vLogin() } });
start();
