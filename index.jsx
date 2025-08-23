
import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown, ChevronRight, Paintbrush, DoorOpen, Layers, Image as ImageIcon, Loader2, Menu, X, Phone, Mail, LayoutGrid, ShoppingCart, ArrowRight, Download
} from "lucide-react";

/**
 * Ecopanel Customizer – Branded Single‑File React SPA
 * - Brand colors: #9EC13F (primary), #848B97 (muted)
 * - Desktop room/view rail shows full text; tablet/mobile collapse to icons
 * - Replace MOCK_DATA & URLs with real backend payloads
 */

const BRAND = { primary: "#9EC13F", muted: "#848B97" };
const LOGO_URL = "https://mlyveh3scf0d.i.optimole.com/w:900/h:325/q:mauto/ig:avif/https://ecopanel.co.zw/wp-content/uploads/2021/07/Ecopanel_Logo_FCol_RDRW.png";
const CDN = "https://images.unsplash.com"; // demo imagery only

const overlay = (seed) => `${CDN}/photo-1554995207-c18c203602cb?auto=format&fit=crop&w=1200&q=60&sat=-100&blend=000&bm=multiply#${seed}`;
const baseImg = (seed) => `${CDN}/photo-1501183638710-841dd1904471?auto=format&fit=crop&w=1600&q=60#${seed}`;

/** Mocked data (replace from API) */
const MOCK_BUILDS = [
  {
    id: "build_a",
    name: "Ecopanel A-Series",
    sizeSqm: 48,
    bedrooms: 2,
    bathrooms: 1,
    basePrice: 12000,
    rooms: [
      {
        id: "ext_iso",
        domain: "Exterior",
        type: "Isometric Front",
        baseImage: baseImg("ext_iso"),
        properties: [
          {
            id: "door",
            name: "Door",
            available: true,
            attributes: [
              {
                id: "door_material",
                name: "Material",
                dataType: "text",
                values: [
                  { id: "wood", label: "Wood", cost: 150, available: true, overlayUrl: overlay("door-wood") },
                  { id: "metal", label: "Metal", cost: 220, available: true, overlayUrl: overlay("door-metal") },
                ],
              },
              {
                id: "door_color",
                name: "Color",
                dataType: "text",
                values: [
                  { id: "white", label: "White", cost: 20, available: true, overlayUrl: overlay("door-white") },
                  { id: "green", label: "Green", cost: 25, available: true, overlayUrl: overlay("door-green") },
                  { id: "blue", label: "Blue", cost: 25, available: true, overlayUrl: overlay("door-blue") },
                ],
              },
            ],
          },
          {
            id: "window",
            name: "Window",
            available: true,
            attributes: [
              {
                id: "window_material",
                name: "Material",
                dataType: "text",
                values: [
                  { id: "aluminum", label: "Aluminum", cost: 120, available: true, overlayUrl: overlay("window-al") },
                  { id: "wood", label: "Wood", cost: 100, available: true, overlayUrl: overlay("window-wood") },
                ],
              },
            ],
          },
          {
            id: "gutters",
            name: "Gutters",
            available: true,
            attributes: [
              {
                id: "has_gutter",
                name: "Include Gutters",
                dataType: "boolean",
                values: [
                  { id: "yes", label: "Yes", cost: 90, available: true, overlayUrl: overlay("gutter-yes") },
                  { id: "no", label: "No", cost: 0, available: true },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "int_kitchen",
        domain: "Interior",
        type: "Kitchen",
        baseImage: baseImg("int_kitchen"),
        properties: [
          {
            id: "counter",
            name: "Kitchen Counter",
            available: true,
            attributes: [
              {
                id: "counter_material",
                name: "Material",
                dataType: "text",
                values: [
                  { id: "hardwood", label: "Hard Wood", cost: 300, available: true, overlayUrl: overlay("counter-hardwood") },
                  { id: "melamine", label: "Melamine", cost: 180, available: true, overlayUrl: overlay("counter-melamine") },
                  { id: "hdf", label: "High‑Density Fiberboard", cost: 220, available: true, overlayUrl: overlay("counter-hdf") },
                ],
              },
            ],
          },
          {
            id: "flooring",
            name: "Flooring",
            available: true,
            attributes: [
              {
                id: "flooring_type",
                name: "Type",
                dataType: "text",
                values: [
                  { id: "tile", label: "Tiles", cost: 240, available: true, overlayUrl: overlay("floor-tiles") },
                  { id: "laminate", label: "Laminate", cost: 180, available: true, overlayUrl: overlay("floor-lam") },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "int_bath",
        domain: "Interior",
        type: "Bathroom",
        baseImage: baseImg("int_bath"),
        properties: [
          {
            id: "toilet",
            name: "Toilet Type",
            available: true,
            attributes: [
              {
                id: "toilet_type",
                name: "Type",
                dataType: "text",
                values: [
                  { id: "standard", label: "Standard", cost: 90, available: true, overlayUrl: overlay("toilet-std") },
                  { id: "dual", label: "Dual‑flush", cost: 130, available: true, overlayUrl: overlay("toilet-dual") },
                ],
              },
            ],
          },
          {
            id: "shower",
            name: "Shower",
            available: true,
            attributes: [
              {
                id: "shower_type",
                name: "Type",
                dataType: "text",
                values: [
                  { id: "walkin_glass", label: "Walk‑in with Glass", cost: 260, available: true, overlayUrl: overlay("shower-walkin") },
                  { id: "cubicle", label: "Cubicle", cost: 180, available: true, overlayUrl: overlay("shower-cubicle") },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "build_b",
    name: "Ecopanel B‑Series",
    sizeSqm: 72,
    bedrooms: 3,
    bathrooms: 2,
    basePrice: 19000,
    rooms: [
      {
        id: "ext_front",
        domain: "Exterior",
        type: "Front",
        baseImage: baseImg("ext_front"),
        properties: [
          {
            id: "paint",
            name: "Exterior Paint",
            available: true,
            attributes: [
              {
                id: "wall_color",
                name: "Wall Color",
                dataType: "text",
                values: [
                  { id: "white", label: "White", cost: 0, available: true, overlayUrl: overlay("paint-white") },
                  { id: "sand", label: "Sand", cost: 35, available: true, overlayUrl: overlay("paint-sand") },
                  { id: "slate", label: "Slate", cost: 35, available: true, overlayUrl: overlay("paint-slate") },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

const currency = (n) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });
const cls = (...c) => c.filter(Boolean).join(" ");

const useLocalDesign = (phone, buildId) => {
  const key = phone ? `ecopanel:design:${phone}:${buildId}` : null;
  const load = () => {
    if (!key) return null;
    try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; }
  };
  const save = (state) => { if (key) localStorage.setItem(key, JSON.stringify(state)); };
  return { load, save };
};

const RailButton = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={cls(
      "group relative flex items-center gap-2 px-3 py-2 rounded-xl",
      "bg-white/80 text-slate-700 hover:bg-white shadow-sm ring-1 ring-black/5"
    )}
    style={active ? { backgroundColor: BRAND.primary, color: "white" } : undefined}
    title={label}
  >
    <Icon className="h-5 w-5" />
    {/* Full text on desktop (lg+); icons on tablet/mobile */}
    <span className="hidden lg:inline">{label}</span>
  </button>
);

const Chip = ({ active, children, onClick }) => (
  <button
    onClick={onClick}
    className={cls(
      "px-3 py-1 rounded-full text-sm border",
      active ? "text-white" : "bg-white hover:bg-slate-50 border-slate-300"
    )}
    style={active ? { backgroundColor: BRAND.primary, borderColor: BRAND.primary } : undefined}
  >
    {children}
  </button>
);

const Section = ({ title, icon: Icon, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
      <button
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-50"
        onClick={() => setOpen((o) => !o)}
      >
        {Icon && <Icon className="h-4 w-4" style={{ color: BRAND.muted }} />}
        <span className="font-medium text-slate-800">{title}</span>
        <div className="ml-auto" style={{ color: BRAND.muted }}>{open ? <ChevronDown /> : <ChevronRight />}</div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="px-4">
            <div className="py-3 border-t border-slate-100">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

function LeadCaptureModal({ open, onSubmit, onClose }) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="p-6">
          <h3 className="text-xl font-semibold">Start customizing your Ecopanel build</h3>
          <p className="mt-1" style={{ color: BRAND.muted }}>Enter your contact details to save your design and return to it later.</p>
          <div className="mt-6 space-y-3">
            <label className="block">
              <span className="text-sm flex items-center gap-2" style={{ color: BRAND.muted }}><Mail className="h-4 w-4" /> Email</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" className="mt-1 w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2" style={{ outlineColor: BRAND.primary }} />
            </label>
            <label className="block">
              <span className="text-sm flex items-center gap-2" style={{ color: BRAND.muted }}><Phone className="h-4 w-4" /> Phone (used as your ID)</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="e.g. +263 77 000 0000" className="mt-1 w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2" style={{ outlineColor: BRAND.primary }} />
            </label>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200">Cancel</button>
            <button
              onClick={() => email && phone && onSubmit({ email, phone })}
              className="px-4 py-2 rounded-xl text-white hover:opacity-90 flex items-center gap-2"
              style={{ backgroundColor: BRAND.primary }}
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Landing({ builds, onPick }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <header className="sticky top-0 z-30 backdrop-blur bg-white/70 border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <img src={LOGO_URL} alt="Ecopanel" className="h-8 w-auto" />
          <span className="font-semibold" style={{ color: BRAND.muted }}></span>
          <span className="ml-auto text-sm" style={{ color: BRAND.muted }}>Prefab panels for fast, strong, beautiful builds</span>
        </div>
      </header>
      <main>
        <section className="relative">
          <div className="h-[46vh] md:h-[60vh] w-full bg-cover bg-center" style={{ backgroundImage: `url(${CDN}/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=2400&q=60)` }} />
          <div className="max-w-5xl mx-auto px-4 -mt-10 relative">
            <div className="rounded-3xl bg-white shadow-xl ring-1 ring-black/5 p-6 md:p-8">
              <h1 className="text-2xl md:text-4xl font-bold">Design your prefab home with the Ecopanel Customizer</h1>
              <p className="mt-2" style={{ color: BRAND.muted }}>Pick a base build, then fine‑tune rooms, finishes, and fixtures. See visuals update instantly and track pricing in real time.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Chip>Energy‑efficient</Chip>
                <Chip>Fast to assemble</Chip>
                <Chip>Customizable</Chip>
              </div>
            </div>
          </div>
        </section>
        <section className="max-w-6xl mx-auto px-4 py-10">
          <h2 className="text-xl md:text-2xl font-semibold">Choose a Build</h2>
          <p style={{ color: BRAND.muted }}>Saved & published builds from the catalog.</p>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {builds.map((b) => (
              <button key={b.id} onClick={() => onPick(b)} className="group text-left rounded-3xl overflow-hidden bg-white shadow-sm ring-1 ring-slate-200 hover:shadow-md">
                <div className="aspect-video bg-cover bg-center" style={{ backgroundImage: `url(${CDN}/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1600&q=60#${b.id})` }} />
                <div className="p-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg group-hover:opacity-80" style={{ color: BRAND.muted }}>{b.name}</h3>
                    <span className="ml-auto rounded-full text-xs px-2 py-0.5" style={{ backgroundColor: "#9EC13F22", color: BRAND.primary }}>{b.sizeSqm} m²</span>
                  </div>
                  <p className="text-sm mt-1" style={{ color: BRAND.muted }}>{b.bedrooms} bed • {b.bathrooms} bath</p>
                  <p className="font-medium mt-2">From {currency(b.basePrice)}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function Customizer({ build, lead, onBack }) {
  const [activeRoomId, setActiveRoomId] = useState(build.rooms[0]?.id);
  const activeRoom = useMemo(() => build.rooms.find(r => r.id === activeRoomId), [build, activeRoomId]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selections, setSelections] = useState({});

  const key = lead?.phone ? `ecopanel:design:${lead.phone}:${build.id}` : null;
  useEffect(() => {
    if (!key) return;
    try { const saved = JSON.parse(localStorage.getItem(key) || "null"); if (saved) { setSelections(saved.selections || {}); setActiveRoomId(saved.activeRoomId || build.rooms[0]?.id); } } catch { }
  }, [key]);
  useEffect(() => { if (key) localStorage.setItem(key, JSON.stringify({ selections, activeRoomId, updatedAt: Date.now(), lead })); }, [selections, activeRoomId]);

  const setValue = (roomId, propertyId, attributeId, valueId) => {
    setSelections((prev) => ({
      ...prev,
      [roomId]: {
        ...(prev[roomId] || {}),
        [propertyId]: {
          ...(prev[roomId]?.[propertyId] || {}),
          [attributeId]: valueId,
        },
      },
    }));
  };

  const currentCost = useMemo(() => {
    let total = build.basePrice;
    for (const room of build.rooms) {
      const rSel = selections[room.id];
      if (!rSel) continue;
      for (const prop of room.properties) {
        const pSel = rSel[prop.id];
        if (!pSel) continue;
        for (const attr of prop.attributes) {
          const vId = pSel[attr.id];
          const v = attr.values.find(v => v.id === vId);
          if (v && v.available) total += v.cost;
        }
      }
    }
    return total;
  }, [selections, build]);

  const overlays = useMemo(() => {
    const items = [];
    const rSel = selections[activeRoom.id] || {};
    for (const prop of activeRoom.properties) {
      if (!prop.available) continue;
      const pSel = rSel[prop.id] || {};
      for (const attr of prop.attributes) {
        const vId = pSel[attr.id];
        const v = attr.values.find(v => v.id === vId);
        if (v && v.overlayUrl && v.available) items.push({ key: `${prop.id}:${attr.id}`, url: v.overlayUrl });
      }
    }
    return items;
  }, [activeRoom, selections]);

  const summary = useMemo(() => {
    const result = [];
    for (const room of build.rooms) {
      const rSel = selections[room.id];
      if (!rSel) continue;
      const chosen = [];
      for (const prop of room.properties) {
        const pSel = rSel[prop.id];
        if (!pSel) continue;
        for (const attr of prop.attributes) {
          const vId = pSel[attr.id];
          const v = attr.values.find(v => v.id === vId);
          if (v) chosen.push({ property: prop.name, attribute: attr.name, value: v.label, cost: v.cost });
        }
      }
      if (chosen.length) result.push({ room: `${room.domain} – ${room.type}`, items: chosen });
    }
    return result;
  }, [selections, build]);

  const downloadQuoteSummary = () => {
    const payload = {
      build: { id: build.id, name: build.name, sizeSqm: build.sizeSqm, bedrooms: build.bedrooms, bathrooms: build.bathrooms, basePrice: build.basePrice },
      lead,
      selections,
      summary,
      totalPrice: currentCost,
      generatedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ecopanel_quote_${build.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative h-screen w-full">
      {/* Full‑screen viewer behind UI */}
      <div className="absolute inset-0 z-0">
        <Viewer room={activeRoom} overlays={overlays} />
      </div>

      {/* Top bar overlay */}
      <div className="absolute top-0 inset-x-0 h-14 border-b bg-white/80 backdrop-blur flex items-center z-30">
        <div className="max-w-[1400px] w-full mx-auto px-3 flex items-center gap-2">
          <button onClick={onBack} className="rounded-xl px-3 py-1.5 bg-slate-100 hover:bg-slate-200">Back</button>
          <div className="flex items-center gap-2">
            <img src={LOGO_URL} alt="Ecopanel" className="h-5 w-auto" />
            <span className="font-semibold" style={{ color: BRAND.muted }}>{build.name}</span>
            <span className="text-sm" style={{ color: BRAND.muted }}>• {build.sizeSqm} m² • {build.bedrooms} bed • {build.bathrooms} bath</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="font-semibold" style={{ color: BRAND.primary }}>{currency(currentCost)}</span>

            <button className="rounded-xl px-3 py-1.5 text-white hover:opacity-90 flex items-center gap-2" style={{ backgroundColor: BRAND.primary }}><ShoppingCart className="h-4 w-4" /> Request Quote</button>

          </div>
        </div>
      </div>

      {/* Floating room/view rail (desktop full text, tablet/mobile icons) */}
      <div className="hidden md:flex fixed right-4 top-24 lg:top-20 z-20 flex-col gap-2">
        {build.rooms.map((r) => (
          <RailButton
            key={r.id}
            icon={r.domain === "Exterior" ? Layers : LayoutGrid}
            label={`${r.domain} • ${r.type}`}
            active={r.id === activeRoomId}
            onClick={() => setActiveRoomId(r.id)}
          />
        ))}
      </div>

      {/* Bottom customize bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 px-3 pb-3">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-center gap-3 rounded-2xl bg-white/90 backdrop-blur ring-1 ring-slate-200 shadow-lg p-2">
            <button onClick={() => setDrawerOpen(true)} className="flex-1 md:flex-none rounded-xl px-4 py-2 text-white font-medium" style={{ backgroundColor: BRAND.primary }}>
              <span className="inline-flex items-center gap-2"><Menu className="h-4 w-4" /> Customize</span>
            </button>
            <button onClick={downloadQuoteSummary} className="rounded-xl px-3 py-2 bg-slate-900 text-white hover:bg-black flex items-center gap-2"><Download className="h-4 w-4" /> Save</button>
            <span className="ml-auto hidden md:inline font-semibold" style={{ color: BRAND.primary }}>{currency(currentCost)}</span>
          </div>
        </div>
      </div>

      {/* Left drawer: slides in from the left (left -> right) */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.aside
              initial={{ x: -460 }}
              animate={{ x: 0 }}
              exit={{ x: -460 }}
              transition={{ type: "spring", stiffness: 280, damping: 28 }}
              className="fixed left-0 top-14 bottom-0 z-30 w-full max-w-[380px] md:max-w-[420px] bg-white ring-1 ring-slate-200 shadow-2xl overflow-y-auto"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b bg-white">
                <div className="font-medium">Customizer</div>
                <button onClick={() => setDrawerOpen(false)} className="rounded-lg p-2 hover:bg-slate-100"><X className="h-4 w-4" /></button>
              </div>
              <div className="p-3 space-y-4">
                <div className="text-xs" style={{ color: BRAND.muted }}>{activeRoom.domain} • {activeRoom.type}</div>
                <CustomizerMenu room={activeRoom} selections={selections[activeRoom.id] || {}} onPick={setValue} />
                <div className="h-px bg-slate-200" />
                <SummaryPanel summary={summary} total={currentCost} />
              </div>
            </motion.aside>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-20 bg-black/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function Viewer({ room, overlays }) {
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); }, [room.id, overlays.map(o => o.key).join(",")]);
  return (
    <div className="relative h-full w-full bg-center bg-cover bg-no-repeat" style={{ backgroundImage: `url(${room?.baseImage || baseImg("fallback")})`, backgroundRepeat: 'no-repeat', backgroundPosition: 'center', backgroundSize: 'cover' }}>
      <AnimatePresence>
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 grid place-items-center bg-transparent">
            <div className="flex items-center gap-3" style={{ color: BRAND.muted }}><Loader2 className="h-5 w-5 animate-spin" /> Loading view…</div>
          </motion.div>
        )}
      </AnimatePresence>
      <img src={room.baseImage} alt={`${room.domain} ${room.type}`} className={"h-full w-full object-cover opacity-0"} onLoad={() => setTimeout(() => setLoading(false), 150)} onError={() => setLoading(false)} />
      {overlays.map((o) => (
        <img key={o.key} src={o.url} alt={o.key} className="absolute inset-0 h-full w-full object-cover" onLoad={() => setTimeout(() => setLoading(false), 150)} onError={() => setLoading(false)} />
      ))}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/10 to-transparent" />
      <div className="absolute right-4 bottom-28 md:bottom-24 rounded-full bg-white/80 backdrop-blur px-3 py-1.5 text-sm ring-1 ring-black/5">
        {room.domain} • {room.type}
      </div>
    </div>
  );
}

function CustomizerMenu({ room, selections, onPick }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Paintbrush className="h-4 w-4" style={{ color: BRAND.muted }} />
        <span className="font-medium">Customizer</span>
        <span className="ml-auto text-xs" style={{ color: BRAND.muted }}>{room.domain} • {room.type}</span>
      </div>
      {room.properties.filter(p => p.available).map((prop) => (
        <Section key={prop.id} title={prop.name} icon={prop.name.toLowerCase().includes("door") ? DoorOpen : ImageIcon}>
          <div className="space-y-4">
            {prop.attributes.map((attr) => (
              <div key={attr.id}>
                <div className="text-sm mb-2" style={{ color: BRAND.muted }}>{attr.name}</div>
                <div className="flex flex-wrap gap-2">
                  {attr.values.filter(v => v.available).map((v) => {
                    const active = selections?.[prop.id]?.[attr.id] === v.id;
                    return (
                      <Chip key={v.id} active={!!active} onClick={() => onPick(room.id, prop.id, attr.id, v.id)}>
                        {v.label} {v.cost ? <span className="opacity-70">(+{currency(v.cost)})</span> : null}
                      </Chip>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Section>
      ))}
    </div>
  );
}

function SummaryPanel({ summary, total, compact }) {
  return (
    <div>
      <div className="flex items-center gap-2 px-1">
        <Layers className="h-4 w-4" style={{ color: BRAND.muted }} />
        <span className="font-medium">Your Selections</span>
        <span className="ml-auto rounded-full text-xs px-2 py-0.5" style={{ backgroundColor: "#9EC13F22", color: BRAND.primary }}>{currency(total)}</span>
      </div>
      <div className="mt-3 space-y-3">
        {summary.length === 0 && (
          <div className="text-sm" style={{ color: BRAND.muted }}>No selections yet. Pick options from the left panel.</div>
        )}
        {summary.map((group) => (
          <div key={group.room} className="rounded-2xl border border-slate-200 p-3">
            <div className="font-medium text-slate-800">{group.room}</div>
            <ul className="mt-2 space-y-1 text-sm">
              {group.items.map((it, i) => (
                <li key={i} className="flex gap-2 justify-between">
                  <span className="text-slate-600">{it.property} → {it.attribute}: <span className="text-slate-900 font-medium">{it.value}</span></span>
                  <span className="text-slate-600">{it.cost ? "+ " + currency(it.cost) : ""}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {!compact && (
        <div className="mt-4 p-3 rounded-2xl" style={{ backgroundColor: "#9EC13F22", color: "#0f3d00", border: "1px solid #9EC13F55" }}>
          <div className="text-sm">Total</div>
          <div className="text-2xl font-semibold">{currency(total)}</div>
          <div className="text-xs mt-1 opacity-80">Price shown is an estimate; final quote may vary after site assessment.</div>
        </div>
      )}
    </div>
  );
}

export default function EcopanelApp() {
  const [step, setStep] = useState("landing");
  const [lead, setLead] = useState(null);
  const [selectedBuild, setSelectedBuild] = useState(null);
  const [leadModal, setLeadModal] = useState(false);

  const pickBuild = (b) => { setSelectedBuild(b); setLeadModal(true); };
  const handleLeadSubmit = (data) => { setLead(data); setLeadModal(false); setStep("customizer"); };

  return (
    <div className="min-h-screen">
      {step === "landing" && <Landing builds={MOCK_BUILDS} onPick={pickBuild} />}
      {step === "customizer" && selectedBuild && (
        <Customizer build={selectedBuild} lead={lead} onBack={() => { setStep("landing"); }} />
      )}
      <LeadCaptureModal open={leadModal} onSubmit={handleLeadSubmit} onClose={() => setLeadModal(false)} />
    </div>
  );
}
