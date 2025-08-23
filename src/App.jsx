// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown, ChevronRight, Paintbrush, DoorOpen, Layers, Image as ImageIcon,
  Loader2, Menu, X, Phone, Mail, LayoutGrid, ArrowRight, Download, LogOut
} from "lucide-react";

import {
  fetchBuilds, fetchBuildRooms,
  upsertLead, createQuote,
  listLeads, listQuotes,
  isValidEmail, signInAdmin, signOutAdmin, isCurrentUserAdmin
} from "./api/supaApi";

// Landing thumbnails only (viewer uses Storage URLs coming from fetchBuildRooms)
import buildAImg from "./assets/builds/build_a/base.jpg";
import buildBImg from "./assets/builds/build_b/base.jpg";
import buildCImg from "./assets/builds/build_c/base.jpg";

const BRAND = { primary: "#9EC13F", muted: "#848B97" };
const LOGO_URL =
  "https://mlyveh3scf0d.i.optimole.com/w:900/h:325/q:mauto/ig:avif/https://ecopanel.co.zw/wp-content/uploads/2021/07/Ecopanel_Logo_FCol_RDRW.png";

const currency = (n) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });
const cls = (...c) => c.filter(Boolean).join(" ");

/* ---------------- pricing ---------------- */
function computePricing({ rooms, selections, basePrice }) {
  const items = [];
  let optionsSubtotal = 0;

  for (const room of rooms) {
    const rSel = selections[room.id];
    if (!rSel) continue;
    for (const prop of room.properties) {
      const pSel = rSel[prop.id];
      if (!pSel) continue;
      for (const attr of prop.attributes) {
        const vId = pSel[attr.id];
        const val = attr.values.find((v) => v.id === vId);
        if (!val) continue;
        const price = Number(val.price || 0);
        optionsSubtotal += price;
        items.push({
          room: `${room.domain} – ${room.type}`,
          property: prop.name,
          attribute: attr.name,
          value: val.label,
          overlayUrl: val.overlayUrl || null,
          layer: val.layer ?? 0,
          price,
        });
      }
    }
  }

  return {
    basePrice,
    optionsSubtotal,
    grandTotal: basePrice + optionsSubtotal,
    items,
  };
}

/* ---------------- tiny UI bits ---------------- */
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

const Section = ({ title, icon: Icon, children, defaultOpen = false, open: controlledOpen, onToggle }) => {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = controlledOpen !== undefined ? controlledOpen : open;
  const toggle = () => (onToggle ? onToggle() : setOpen((o) => !o));
  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
      <button className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-50" onClick={toggle}>
        {Icon && <Icon className="h-4 w-4" style={{ color: BRAND.muted }} />}
        <span className="font-medium text-slate-800">{title}</span>
        <div className="ml-auto" style={{ color: BRAND.muted }}>{isOpen ? <ChevronDown /> : <ChevronRight />}</div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="px-4">
            <div className="py-3 border-t border-slate-100">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ---------------- Lead modal ---------------- */
function LeadCaptureModal({ open, onSubmit, onClose, validateEmail }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState("");
  if (!open) return null;

  const submit = () => {
    if (!firstName || !lastName || !email || !phone) return setErr("Please fill in all fields.");
    if (!validateEmail(email)) return setErr("Please enter a valid email address.");
    setErr("");
    onSubmit({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="p-6">
          <h3 className="text-xl font-semibold">Start customizing your Ecopanel build</h3>
          <p className="mt-1" style={{ color: BRAND.muted }}>
            Enter your contact details to save your design and return to it later.
          </p>

          <div className="mt-6 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm" style={{ color: BRAND.muted }}>Name</span>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  type="text"
                  placeholder="e.g. Tadiwa"
                  className="mt-1 w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2"
                  style={{ outlineColor: BRAND.primary }}
                />
              </label>
              <label className="block">
                <span className="text-sm" style={{ color: BRAND.muted }}>Surname</span>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  type="text"
                  placeholder="e.g. Moyo"
                  className="mt-1 w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2"
                  style={{ outlineColor: BRAND.primary }}
                />
              </label>
            </div>

            <label className="block">
              <span className="text-sm flex items-center gap-2" style={{ color: BRAND.muted }}>
                <Mail className="h-4 w-4" /> Email
              </span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="you@example.com"
                className="mt-1 w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2"
                style={{ outlineColor: BRAND.primary }}
              />
            </label>

            <label className="block">
              <span className="text-sm flex items-center gap-2" style={{ color: BRAND.muted }}>
                <Phone className="h-4 w-4" /> Phone (used as your ID)
              </span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="tel"
                placeholder="e.g. +263 77 000 0000"
                className="mt-1 w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2"
                style={{ outlineColor: BRAND.primary }}
              />
            </label>

            {!!err && <div className="text-sm text-red-600">{err}</div>}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200">Cancel</button>
            <button
              onClick={submit}
              className="px-4 py-2 rounded-xl text-white hover:opacity-90 flex items-center gap-2"
              style={{ backgroundColor: BRAND.primary }}
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Landing ---------------- */
function Landing({ builds, onPick }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <header className="sticky top-0 z-30 backdrop-blur bg-white/70 border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <img src={LOGO_URL} alt="Ecopanel" className="h-8 w-auto" />
          <span className="ml-auto text-sm" style={{ color: BRAND.muted }}>
            Prefab panels for fast, strong, beautiful builds
          </span>
        </div>
      </header>
      <main>
        <section className="relative">
          <div
            className="h-[46vh] md:h-[60vh] w-full bg-cover bg-center"
            style={{ backgroundImage: "url(https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=2400&q=60)" }}
          />
          <div className="max-w-5xl mx-auto px-4 -mt-10 relative">
            <div className="rounded-3xl bg-white shadow-xl ring-1 ring-black/5 p-6 md:p-8">
              <h1 className="text-2xl md:text-4xl font-bold">Design your prefab home with the Ecopanel Customizer</h1>
              <p className="mt-2" style={{ color: BRAND.muted }}>
                Pick a base build, then fine-tune rooms, finishes, and fixtures. See visuals update instantly.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Chip>Energy-efficient</Chip>
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
              <button
                key={b.id}
                onClick={() => onPick(b)}
                className="group text-left rounded-3xl overflow-hidden bg-white shadow-sm ring-1 ring-slate-200 hover:shadow-md"
              >
                <div
                  className="aspect-video bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${b.id === "build_a" ? buildAImg : b.id === "build_b" ? buildBImg : buildCImg})`,
                  }}
                />
                <div className="p-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg group-hover:opacity-80" style={{ color: BRAND.muted }}>
                      {b.name}
                    </h3>
                    <span
                      className="ml-auto rounded-full text-xs px-2 py-0.5"
                      style={{ backgroundColor: "#9EC13F22", color: BRAND.primary }}
                    >
                      {b.sizeSqm} m²
                    </span>
                  </div>
                  <p className="text-sm mt-1" style={{ color: BRAND.muted }}>
                    {b.bedrooms} bed • {b.bathrooms} bath
                  </p>
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

/* ---------------- Customizer (full) ---------------- */
function Customizer({ build, lead, onBack, rooms }) {
  const [activeRoomId, setActiveRoomId] = useState(rooms[0]?.id);
  const activeRoom = useMemo(() => rooms.find((r) => r.id === activeRoomId), [rooms, activeRoomId]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selections, setSelections] = useState({});
  const [quoteMsg, setQuoteMsg] = useState("");

  // auto-open drawer on large screens
  useEffect(() => { try { if (window.innerWidth >= 1024) setDrawerOpen(true); } catch { } }, []);

  // persist locally by lead+build
  const key = lead?.phone ? `ecopanel:design:${lead.phone}:${build.id}` : null;

  useEffect(() => {
    if (!key) return;
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (saved) {
        setSelections(saved.selections || {});
        setActiveRoomId(saved.activeRoomId || rooms[0]?.id);
      }
    } catch { }
  }, [key, rooms]);

  useEffect(() => {
    if (key) localStorage.setItem(key, JSON.stringify({ selections, activeRoomId, updatedAt: Date.now(), lead }));
  }, [selections, activeRoomId]);

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

  /** overlay stack from selections (pure overlays) */
  const overlays = useMemo(() => {
    if (!activeRoom) return [];
    const items = [];
    const rSel = selections[activeRoom.id] || {};
    for (const prop of activeRoom.properties) {
      const pSel = rSel[prop.id] || {};
      for (const attr of prop.attributes) {
        const vId = pSel[attr.id];
        const v = attr.values.find((vv) => vv.id === vId);
        if (v?.overlayUrl) {
          items.push({
            key: `${prop.id}:${attr.id}`,
            url: v.overlayUrl,
            layer: typeof v.layer === "number" ? v.layer : 0,
            opacity: typeof v.opacity === "number" ? v.opacity : 1,
            blend: v.blend || undefined,
          });
        }
      }
    }
    items.sort((a, b) => (a.layer || 0) - (b.layer || 0));
    return items;
  }, [activeRoom, selections]);

  /** visible summary (labels only) */
  const summary = useMemo(() => {
    const result = [];
    for (const room of rooms) {
      const rSel = selections[room.id];
      if (!rSel) continue;
      const chosen = [];
      for (const prop of room.properties) {
        const pSel = rSel[prop.id];
        if (!pSel) continue;
        for (const attr of prop.attributes) {
          const vId = pSel[attr.id];
          const v = attr.values.find((vv) => vv.id === vId);
          if (v) chosen.push({ property: prop.name, attribute: attr.name, value: v.label });
        }
      }
      if (chosen.length) result.push({ room: `${room.domain} – ${room.type}`, items: chosen });
    }
    return result;
  }, [selections, rooms]);

  /** hidden pricing */
  const pricing = useMemo(
    () => computePricing({ rooms, selections, basePrice: build.basePrice }),
    [rooms, selections, build.basePrice]
  );

  const downloadQuoteSummary = () => {
    const payload = {
      build: {
        id: build.id, name: build.name, sizeSqm: build.sizeSqm,
        bedrooms: build.bedrooms, bathrooms: build.bathrooms, basePrice: build.basePrice
      },
      lead,
      selections,
      summary,
      pricing,
      generatedAt: new Date().toISOString(),
      totals: {
        base: pricing.basePrice,
        options: pricing.optionsSubtotal,
        grandTotal: pricing.grandTotal,
        grandTotalFormatted: currency(pricing.grandTotal),
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ecopanel_quote_${build.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* write quote to Supabase; Edge Function emails the quotation (uses pricing.items) */
  const requestQuote = async () => {
    setQuoteMsg("");
    if (!lead?.id) {
      setQuoteMsg("Please enter your details first.");
      return;
    }
    try {
      await createQuote({ buildId: build.id, leadId: lead.id, selections, pricing });
      setQuoteMsg("Thanks! Your quotation has been emailed.");
    } catch (e) {
      console.error("createQuote failed:", e);
      setQuoteMsg("Could not submit quote right now. Saved a local copy instead.");
      downloadQuoteSummary();
    }
  };

  useEffect(() => {
    const onKey = (e) => {
      const k = (e.key || "").toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === "s") { e.preventDefault(); downloadQuoteSummary(); }
      if (k === "escape") setDrawerOpen(false);
      if (k === "c") setDrawerOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!activeRoom) return null;

  return (
    <div className="relative h-screen w-full">
      {/* Full-screen viewer */}
      <div className="absolute inset-0 z-0">
        <Viewer room={activeRoom} overlays={overlays} />
      </div>

      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 h-14 border-b bg-white/80 backdrop-blur flex items-center z-30">
        <div className="max-w-[1400px] w-full mx-auto px-3 flex items-center gap-2">
          <button onClick={onBack} className="hidden rounded-xl px-3 py-1.5 bg-slate-100 hover:bg-slate-200">Back</button>
          <div className="flex items-center gap-2">
            <img src={LOGO_URL} alt="Ecopanel" className="h-5 w-auto" />
            <span className="hidden font-semibold" style={{ color: BRAND.muted }}>{build.name}</span>
            <span className="hidden text-sm" style={{ color: BRAND.muted }}>
              • {build.sizeSqm} m² • {build.bedrooms} bed • {build.bathrooms} bath
            </span>
          </div>
          <div className="ml-auto flex items-center gap-3" />
        </div>
      </div>

      {/* Sub bar */}
      <div className="absolute top-14 inset-x-0 h-12 border-b bg-white/80 backdrop-blur flex items-center z-30">
        <div className="max-w-[1400px] w-full mx-auto px-3 flex items-center gap-2">
          <button onClick={onBack} className="rounded-xl px-3 py-1.5 bg-slate-100 hover:bg-slate-200">Back</button>
          <div className="font-medium" style={{ color: BRAND.muted }}>{build.name}</div>
          <span className="ml-auto" />
        </div>
      </div>

      {/* Room rail */}
      <div className="flex fixed right-2 top-[8rem] sm:right-3 md:right-4 md:top-[8rem] lg:top-[7rem] z-30 flex-col gap-2">
        {rooms.map((r) => (
          <RailButton
            key={r.id}
            icon={r.domain === "Exterior" ? Layers : LayoutGrid}
            label={`${r.domain} • ${r.type}`}
            active={r.id === activeRoomId}
            onClick={() => setActiveRoomId(r.id)}
          />
        ))}
      </div>

      {/* Floating buttons */}
      <div className="fixed right-4 bottom-6 z-30 flex gap-3">
        <button
          onClick={() => setDrawerOpen(true)}
          className="rounded-full px-4 py-2 text-white font-medium shadow-lg"
          style={{ backgroundColor: BRAND.primary }}
        >
          <Menu className="inline h-4 w-4 mr-1" /> Customize
        </button>
        <button
          onClick={downloadQuoteSummary}
          className="rounded-full px-4 py-2 bg-slate-900 text-white hover:bg-black shadow-lg flex items-center gap-2"
        >
          <Download className="h-4 w-4" /> Save
        </button>
      </div>

      {/* Drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.aside
              initial={{ x: -460 }} animate={{ x: 0 }} exit={{ x: -460 }}
              transition={{ type: "spring", stiffness: 280, damping: 28 }}
              className="fixed left-0 top-[6.5rem] bottom-0 z-30 w-full max-w-[380px] md:max-w-[420px] bg-white ring-1 ring-slate-200 shadow-2xl overflow-y-auto"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b bg-white">
                <div className="font-medium">Customizer</div>
                <button onClick={() => setDrawerOpen(false)} className="rounded-lg p-2 hover:bg-slate-100">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-3 space-y-4">
                <div className="text-xs" style={{ color: BRAND.muted }}>{activeRoom.domain} • {activeRoom.type}</div>
                <CustomizerMenu room={activeRoom} selections={selections[activeRoom.id] || {}} onPick={setValue} />
                <div className="h-px bg-slate-200" />
                <SummaryPanel summary={summary} onGetQuote={requestQuote} quoteStatus={quoteMsg} />
              </div>
            </motion.aside>
            <motion.div
              className="fixed inset-0 z-20 bg-black/30"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
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
  useEffect(() => { setLoading(true); }, [room.id, overlays.map(o => `${o.key}:${o.url}`).join(",")]);

  return (
    <div
      className="relative h-full w-full bg-center bg-cover bg-no-repeat"
      style={{ backgroundImage: `url(${room?.baseImage})`, backgroundRepeat: "no-repeat", backgroundPosition: "center", backgroundSize: "cover" }}
    >
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 grid place-items-center bg-transparent"
          >
            <div className="flex items-center gap-3" style={{ color: BRAND.muted }}>
              <Loader2 className="h-5 w-5 animate-spin" /> Loading view…
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* preload base */}
      <img
        src={room.baseImage}
        alt={`${room.domain} ${room.type}`}
        className="h-full w-full object-cover opacity-0"
        onLoad={() => setTimeout(() => setLoading(false), 150)}
        onError={() => setLoading(false)}
      />

      {/* overlays */}
      {overlays.map((o) => (
        <img
          key={o.key}
          src={o.url}
          alt={o.key}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ opacity: o.opacity ?? 1, mixBlendMode: o.blend || "normal" }}
          onLoad={() => setTimeout(() => setLoading(false), 150)}
          onError={() => setLoading(false)}
        />
      ))}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/10 to-transparent" />
      <div className="absolute right-4 bottom-28 md:bottom-24 rounded-full bg-white/80 backdrop-blur px-3 py-1.5 text-sm ring-1 ring-black/5">
        {room.domain} • {room.type}
      </div>
    </div>
  );
}

function CustomizerMenu({ room, selections, onPick }) {
  const [openId, setOpenId] = useState(null);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Paintbrush className="h-4 w-4" style={{ color: BRAND.muted }} />
        <span className="font-medium">Customizer</span>
        <span className="ml-auto text-xs" style={{ color: BRAND.muted }}>{room.domain} • {room.type}</span>
      </div>
      {room.properties.map((prop) => (
        <Section
          key={prop.id}
          title={prop.name}
          icon={prop.name.toLowerCase().includes("door") ? DoorOpen : ImageIcon}
          open={openId === prop.id}
          onToggle={() => setOpenId(openId === prop.id ? null : prop.id)}
        >
          <div className="space-y-4">
            {prop.attributes.map((attr) => (
              <div key={attr.id}>
                <div className="text-sm mb-2" style={{ color: BRAND.muted }}>{attr.name}</div>
                <div className="flex flex-wrap gap-2">
                  {attr.values.map((v) => {
                    const active = selections?.[prop.id]?.[attr.id] === v.id;
                    return (
                      <Chip key={v.id} active={!!active} onClick={() => onPick(room.id, prop.id, attr.id, v.id)}>
                        {v.label}
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

function SummaryPanel({ summary, onGetQuote, quoteStatus }) {
  return (
    <div>
      <div className="flex items-center gap-2 px-1">
        <Layers className="h-4 w-4" style={{ color: BRAND.muted }} />
        <span className="font-medium">Your Selections</span>
      </div>
      <div className="mt-3 space-y-3">
        {summary.length === 0 && (
          <div className="text-sm" style={{ color: BRAND.muted }}>
            No selections yet. Pick options from the left panel.
          </div>
        )}
        {summary.map((group) => (
          <div key={group.room} className="rounded-2xl border border-slate-200 p-3">
            <div className="font-medium text-slate-800">{group.room}</div>
            <ul className="mt-2 space-y-1 text-sm">
              {group.items.map((it, i) => (
                <li key={i} className="flex gap-2 justify-between">
                  <span className="text-slate-600">
                    {it.property} → {it.attribute}: <span className="text-slate-900 font-medium">{it.value}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <button
          onClick={onGetQuote}
          className="w-full rounded-xl px-4 py-2 text-white font-medium"
          style={{ backgroundColor: BRAND.primary }}
        >
          Get a quote
        </button>
        {quoteStatus && <div className="mt-2 text-sm" style={{ color: BRAND.muted }}>{quoteStatus}</div>}
      </div>
    </div>
  );
}

/* ---------------- Admin login gate ---------------- */
function AdminGate({ children }) {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [err, setErr] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => { (async () => { try { setIsAdmin(await isCurrentUserAdmin()); } finally { setChecking(false); } })(); }, []);

  const doLogin = async () => {
    setErr("");
    try {
      await signInAdmin({ email, password });
      const ok = await isCurrentUserAdmin();
      if (!ok) { setErr("You are not authorized as admin."); return; }
      setIsAdmin(true);
    } catch (e) {
      setErr(e?.message || String(e));
    }
  };

  if (checking) return <div className="p-6">Checking access…</div>;
  if (!isAdmin) {
    return (
      <div className="min-h-screen grid place-items-center p-4">
        <div className="w-full max-w-sm rounded-2xl border p-5 bg-white">
          <h2 className="text-xl font-semibold mb-3">Admin Sign In</h2>
          <label className="block mb-2">
            <span className="text-sm text-slate-600">Email</span>
            <input className="mt-1 w-full rounded-xl border px-3 py-2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block mb-3">
            <span className="text-sm text-slate-600">Password</span>
            <input className="mt-1 w-full rounded-xl border px-3 py-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {err && <div className="text-sm text-red-600 mb-2">{err}</div>}
          <button onClick={doLogin} className="w-full rounded-xl px-4 py-2 text-white" style={{ backgroundColor: BRAND.primary }}>
            Sign in
          </button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

/* ---------------- Admin panel ---------------- */
function AdminPanel() {
  const [tab, setTab] = useState("quotes");
  const [leads, setLeads] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true); setErr("");
    try {
      const [L, Q] = await Promise.all([listLeads(), listQuotes()]);
      setLeads(L); setQuotes(Q);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold">Admin</h1>
        <button
          onClick={async () => { await signOutAdmin(); location.reload(); }}
          className="ml-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab("quotes")} className={`px-3 py-1 rounded ${tab === "quotes" ? "bg-black text-white" : "bg-slate-100"}`}>Quotes</button>
        <button onClick={() => setTab("leads")} className={`px-3 py-1 rounded ${tab === "leads" ? "bg-black text-white" : "bg-slate-100"}`}>Leads</button>
        <button onClick={load} className="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200">Refresh</button>
      </div>

      {err && <div className="mb-3 text-sm text-red-600">{err}</div>}

      {loading ? <div>Loading…</div> : tab === "quotes" ? (
        <div className="overflow-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-2">ID</th>
                <th className="text-left p-2">Build</th>
                <th className="text-left p-2">Lead</th>
                <th className="text-left p-2">Total (USD)</th>
                <th className="text-left p-2">Created</th>
                <th className="text-left p-2">Emailed</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id} className="border-t">
                  <td className="p-2">{q.id}</td>
                  <td className="p-2">{q.build_id}</td>
                  <td className="p-2">{q.lead_id}</td>
                  <td className="p-2">{Number(q?.pricing?.grandTotal || 0).toLocaleString()}</td>
                  <td className="p-2">{q.created_at ? new Date(q.created_at).toLocaleString() : "—"}</td>
                  <td className="p-2">{q.emailed_at ? new Date(q.emailed_at).toLocaleString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">Surname</th>
                <th className="text-left p-2">Email</th>
                <th className="text-left p-2">Phone</th>
                <th className="text-left p-2">Updated</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => {
                const updated = l.updated_at || l.inserted_at || l.created_at || null;
                return (
                  <tr key={l.id} className="border-t">
                    <td className="p-2">{l.first_name || "—"}</td>
                    <td className="p-2">{l.last_name || "—"}</td>
                    <td className="p-2">{l.email}</td>
                    <td className="p-2">{l.phone}</td>
                    <td className="p-2">{updated ? new Date(updated).toLocaleString() : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------------- Root ---------------- */
export default function EcopanelApp() {
  const [step, setStep] = useState("landing");
  const [lead, setLead] = useState(null);
  const [selectedBuild, setSelectedBuild] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [builds, setBuilds] = useState([]);
  const [leadModal, setLeadModal] = useState(false);

  useEffect(() => { (async () => setBuilds(await fetchBuilds()))(); }, []);

  const pickBuild = async (b) => {
    setSelectedBuild(b);
    const fetched = await fetchBuildRooms(b.id);
    setRooms(fetched);
    setLeadModal(true);
  };

  const handleLeadSubmit = async (data) => {
    try {
      const row = await upsertLead({
        email: data.email,
        phone: data.phone,
        firstName: data.firstName,
        lastName: data.lastName,
      });
      setLead({ ...data, id: row.id });
    } catch (err) {
      console.error("upsertLead failed:", err);
      setLead(data); // continue anyway so they can still customize, local save works
    } finally {
      setLeadModal(false);
      setStep("customizer");
    }
  };

  const isAdmin =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("admin") === "1";

  return (
    <div className="min-h-screen">
      {isAdmin ? (
        <AdminGate><AdminPanel /></AdminGate>
      ) : (
        <>
          {step === "landing" && <Landing builds={builds} onPick={pickBuild} />}
          {step === "customizer" && selectedBuild && rooms.length > 0 && (
            <Customizer build={selectedBuild} lead={lead} onBack={() => setStep("landing")} rooms={rooms} />
          )}
          <LeadCaptureModal
            open={leadModal}
            onSubmit={handleLeadSubmit}
            onClose={() => setLeadModal(false)}
            validateEmail={isValidEmail}
          />
        </>
      )}
    </div>
  );
}

export { EcopanelApp, computePricing, currency, cls, BRAND, LOGO_URL };
