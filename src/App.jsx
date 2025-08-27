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

/* ───────────────── helpers ───────────────── */
function derive1Variant(url) {
  if (!url) return "";
  const q = url.indexOf("?");
  const base = q >= 0 ? url.slice(0, q) : url;
  const qs = q >= 0 ? url.slice(q) : "";
  const slash = base.lastIndexOf("/");
  const dot = base.lastIndexOf(".");
  const name = base.slice(slash + 1, dot >= 0 ? dot : undefined);
  const ext = dot >= 0 ? base.slice(dot) : "";
  const newName =
    name === "base"
      ? "base1"
      : /(^|[^a-z])base($|[^0-9a-z])/i.test(name)
        ? name.replace(/base/i, "base1")
        : name + "1";
  return base.slice(0, slash + 1) + newName + ext + qs;
}

function useIsMobile(breakpoint = 767) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.matchMedia(`(max-width:${breakpoint}px)`).matches : false
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(`(max-width:${breakpoint}px)`);
    const handler = (e) => setIsMobile(e.matches);
    if (mql.addEventListener) mql.addEventListener("change", handler);
    else mql.addListener(handler);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", handler);
      else mql.removeListener(handler);
    };
  }, [breakpoint]);
  return isMobile;
}

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
          // NOTE: keep desktop overlay for exports
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

  /** overlay stack from selections — now captures desktop + mobile variants */
  const overlays = useMemo(() => {
    if (!activeRoom) return [];
    const items = [];
    const rSel = selections[activeRoom.id] || {};
    for (const prop of activeRoom.properties) {
      const pSel = rSel[prop.id] || {};
      for (const attr of prop.attributes) {
        const vId = pSel[attr.id];
        const v = attr.values.find((vv) => vv.id === vId);
        if (v?.overlayUrl || v?.overlayUrl1) {
          items.push({
            key: `${prop.id}:${attr.id}`,
            // desktop + mobile variants
            url: v.overlayUrl || null,
            url1: v.overlayUrl1 || (v.overlayUrl ? derive1Variant(v.overlayUrl) : null),
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

/* ---------------- Viewer with desktop/mobile overlays ---------------- */
function Viewer({ room, overlays }) {
  const isMobile = useIsMobile();

  // Prefer API-provided variants; otherwise derive mobile from desktop
  const baseUrl = room?.images?.base || room?.baseImage || "";
  const base1Url = room?.images?.base1 || derive1Variant(baseUrl);

  const pickInitial = () => (isMobile ? (base1Url || baseUrl) : baseUrl);

  const [bgSrc, setBgSrc] = useState(pickInitial);
  const [loading, setLoading] = useState(true);

  // Update when room or viewport mode changes
  useEffect(() => {
    setLoading(true);
    setBgSrc(pickInitial());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id, isMobile]);

  // Re-trigger spinner briefly when overlay list changes
  useEffect(() => {
    setLoading(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlays.map(o => `${o.key}:${o.url}:${o.url1}`).join(",")]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Spinner layer */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 grid place-items-center pointer-events-none"
          >
            <div className="flex items-center gap-3" style={{ color: BRAND.muted }}>
              <Loader2 className="h-5 w-5 animate-spin" /> Loading view…
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Base image as <img> so it shares the same geometry as overlays */}
      <img
        src={bgSrc}
        alt={`${room.domain} ${room.type}`}
        className="absolute inset-0 h-full w-full object-cover select-none"
        draggable={false}
        onLoad={() => setTimeout(() => setLoading(false), 120)}
        onError={() => {
          // If mobile variant failed, fall back to desktop once
          if (bgSrc !== baseUrl) setBgSrc(baseUrl || bgSrc);
          else setLoading(false);
        }}
      />

      {/* Overlay stack with explicit z-index above base */}
      {overlays.map((o, idx) => {
        const overlaySrc = isMobile ? (o.url1 || o.url) : o.url;
        if (!overlaySrc) return null;
        return (
          <img
            key={o.key}
            src={overlaySrc}
            alt={o.key}
            className="absolute inset-0 h-full w-full object-cover select-none"
            style={{ opacity: o.opacity ?? 1, mixBlendMode: o.blend || "normal", zIndex: 20 + (o.layer ?? idx) }}
            draggable={false}
            onLoad={() => setTimeout(() => setLoading(false), 80)}
            onError={() => setLoading(false)}
          />
        );
      })}

      {/* UI chrome */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/10 to-transparent z-30" />
      <div className="absolute right-4 bottom-28 md:bottom-24 rounded-full bg-white/80 backdrop-blur px-3 py-1.5 text-sm ring-1 ring-black/5 z-30">
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
// (unchanged below this point; kept for completeness)

function AdminPanel() {
  const [tab, setTab] = useState("quotes"); // "quotes" | "leads" | "catalog"
  const [leads, setLeads] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // date filtering
  const [preset, setPreset] = useState("7d"); // "7d" | "30d" | "90d" | "all" | "custom"
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const rangeToDates = () => {
    if (preset === "all") return { from: undefined, to: undefined };
    if (preset === "custom") return { from: from || undefined, to: to || undefined };
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1); // exclusive end (tomorrow 00:00)
    const start = new Date(end);
    const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
    start.setDate(end.getDate() - days);
    return { from: start.toISOString(), to: end.toISOString() };
  };

  const load = async () => {
    setLoading(true); setErr("");
    try {
      const { from: f, to: t } = rangeToDates();
      const [L, Q] = await Promise.all([listLeads({ from: f, to: t }), listQuotes({ from: f, to: t })]);
      setLeads(L); setQuotes(Q);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* initial */ }, []);
  useEffect(() => { load(); /* reload on filter change */ }, [preset, from, to]);

  const pill = (active) =>
    `px-3 py-1 rounded-xl border ${active ? "bg-black text-white border-black" : "bg-white hover:bg-slate-50 border-slate-300"}`;

  const infoCard = ({ label, value }) => (
    <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-4 min-w-[160px]">
      <div className="text-sm" style={{ color: BRAND.muted }}>{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold">Admin</h1>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={async () => { await signOutAdmin(); location.reload(); }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-3">
        <button onClick={() => setTab("quotes")} className={pill(tab === "quotes")}>Quotes</button>
        <button onClick={() => setTab("leads")} className={pill(tab === "leads")}>Leads</button>
        <button onClick={() => setTab("catalog")} className={pill(tab === "catalog")}>Catalog</button>
        <button onClick={load} className="ml-auto px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200">Refresh</button>
      </div>

      {/* Filter bar */}
      {tab !== "catalog" && (
        <div className="mb-4 rounded-2xl bg-white ring-1 ring-slate-200 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm" style={{ color: BRAND.muted }}>Date:</div>
            {["7d", "30d", "90d", "all", "custom"].map(p => (
              <button key={p} onClick={() => setPreset(p)} className={pill(preset === p)}>
                {p === "7d" ? "Last 7 days" :
                  p === "30d" ? "Last 30 days" :
                    p === "90d" ? "Last 90 days" :
                      p === "all" ? "All time" : "Custom"}
              </button>
            ))}
            {preset === "custom" && (
              <>
                <input type="date" className="rounded-xl border px-3 py-1.5" value={from} onChange={(e) => setFrom(e.target.value)} />
                <span className="text-slate-400">→</span>
                <input type="date" className="rounded-xl border px-3 py-1.5" value={to} onChange={(e) => setTo(e.target.value)} />
              </>
            )}
            <span className="ml-auto" />
            <button
              onClick={() => {
                if (tab === "quotes") {
                  const rows = quotes.map(q => ({
                    id: q.id,
                    build_id: q.build_id,
                    lead_id: q.lead_id,
                    total_usd: Number(q?.pricing?.grandTotal || 0),
                    created_at: q.created_at,
                    emailed_at: q.emailed_at
                  }));
                  exportCsv(rows, "quotes.csv");
                } else {
                  const rows = leads.map(l => ({
                    id: l.id,
                    first_name: l.first_name || "",
                    last_name: l.last_name || "",
                    email: l.email || "",
                    phone: l.phone || "",
                    updated_at: l.updated_at || l.inserted_at || l.created_at || ""
                  }));
                  exportCsv(rows, "leads.csv");
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-black"
            >
              Export CSV
            </button>
          </div>
        </div>
      )}

      {err && <div className="mb-3 text-sm text-red-600">{err}</div>}

      {/* KPI row */}
      {tab !== "catalog" && (
        <div className="flex gap-3 mb-4 overflow-x-auto">
          {infoCard({ label: "Quotes in range", value: quotes.length.toLocaleString() })}
          {infoCard({ label: "Leads in range", value: leads.length.toLocaleString() })}
          {infoCard({ label: "Avg Quote (USD)", value: quotes.length ? Math.round(quotes.reduce((s, q) => s + Number(q?.pricing?.grandTotal || 0), 0) / quotes.length).toLocaleString() : "—" })}
        </div>
      )}

      {/* Tables */}
      {loading ? (
        <div className="p-6 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : tab === "quotes" ? (
        <div className="overflow-auto rounded-2xl ring-1 ring-slate-200 bg-white">
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
      ) : tab === "leads" ? (
        <div className="overflow-auto rounded-2xl ring-1 ring-slate-200 bg-white">
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
      ) : (
        <CatalogManager />
      )}
    </div>
  );
}

/* ---------------- Catalog Manager (unchanged authoring UX) ---------------- */
function Field({ label, ...rest }) {
  return (
    <label className="block">
      <span className="text-sm" style={{ color: BRAND.muted }}>{label}</span>
      <input {...rest} className="mt-1 w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2" style={{ outlineColor: BRAND.primary }} />
    </label>
  );
}

function CatalogManager() {
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");

  // Build
  const [b, setB] = useState({ id: "", name: "", sizeSqm: "", bedrooms: "", bathrooms: "", basePrice: "" });

  // Room
  const [r, setR] = useState({ buildId: "", domain: "Exterior", type: "", baseImage: "" });

  // Property / Attribute / Value
  const [prop, setProp] = useState({ roomId: "", code: "", name: "" });
  const [attr, setAttr] = useState({ propertyId: "", code: "", name: "" });
  const [val, setVal] = useState({ attributeId: "", code: "", label: "", overlayUrl: "", layer: 0, price: 0, opacity: "", blend: "" });

  const run = async (fn, payload, okMsg) => {
    setCreating(true); setMsg("");
    try { await fn(payload); setMsg(okMsg || "Saved."); }
    catch (e) { setMsg(e?.message || String(e)); }
    finally { setCreating(false); }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Create Build */}
      <div className="rounded-2xl ring-1 ring-slate-200 bg-white p-4 space-y-3">
        <div className="text-lg font-semibold">Add Build</div>
        <Field label="Build ID (slug)" value={b.id} onChange={(e) => setB(v => ({ ...v, id: e.target.value }))} placeholder="build_a" />
        <Field label="Name" value={b.name} onChange={(e) => setB(v => ({ ...v, name: e.target.value }))} placeholder="Ecopanel A-Series" />
        <div className="grid grid-cols-3 gap-3">
          <Field label="Size (sqm)" value={b.sizeSqm} onChange={(e) => setB(v => ({ ...v, sizeSqm: e.target.value }))} />
          <Field label="Beds" value={b.bedrooms} onChange={(e) => setB(v => ({ ...v, bedrooms: e.target.value }))} />
          <Field label="Baths" value={b.bathrooms} onChange={(e) => setB(v => ({ ...v, bathrooms: e.target.value }))} />
        </div>
        <Field label="Base Price (USD)" value={b.basePrice} onChange={(e) => setB(v => ({ ...v, basePrice: e.target.value }))} />
        <button
          disabled={creating}
          onClick={() => run(createBuild, b, "Build created")}
          className="w-full rounded-xl px-4 py-2 text-white font-medium disabled:opacity-50"
          style={{ backgroundColor: BRAND.primary }}
        >
          Create Build
        </button>
      </div>

      {/* Create Room */}
      <div className="rounded-2xl ring-1 ring-slate-200 bg-white p-4 space-y-3">
        <div className="text-lg font-semibold">Add Room</div>
        <Field label="Build ID" value={r.buildId} onChange={(e) => setR(v => ({ ...v, buildId: e.target.value }))} placeholder="build_a" />
        <Field label="Domain (Exterior / Interior)" value={r.domain} onChange={(e) => setR(v => ({ ...v, domain: e.target.value }))} />
        <Field label="Type" value={r.type} onChange={(e) => setR(v => ({ ...v, type: e.target.value }))} placeholder="Front, Kitchen, Bathroom..." />
        <Field label="Base Image URL" value={r.baseImage} onChange={(e) => setR(v => ({ ...v, baseImage: e.target.value }))} placeholder="https://.../exterior/base.jpg" />
        <button
          disabled={creating}
          onClick={() => run(createRoom, r, "Room created")}
          className="w-full rounded-xl px-4 py-2 text-white font-medium disabled:opacity-50"
          style={{ backgroundColor: BRAND.primary }}
        >
          Create Room
        </button>
      </div>

      {/* Create Property */}
      <div className="rounded-2xl ring-1 ring-slate-200 bg-white p-4 space-y-3">
        <div className="text-lg font-semibold">Add Property</div>
        <Field label="Room Row ID" value={prop.roomId} onChange={(e) => setProp(v => ({ ...v, roomId: e.target.value }))} placeholder="rooms.id (UUID)" />
        <Field label="Property Code" value={prop.code} onChange={(e) => setProp(v => ({ ...v, code: e.target.value }))} placeholder="door, siding_color..." />
        <Field label="Property Name" value={prop.name} onChange={(e) => setProp(v => ({ ...v, name: e.target.value }))} placeholder="Door, Siding Color" />
        <button
          disabled={creating}
          onClick={() => run(upsertProperty, prop, "Property saved")}
          className="w-full rounded-xl px-4 py-2 text-white font-medium disabled:opacity-50"
          style={{ backgroundColor: BRAND.primary }}
        >
          Upsert Property
        </button>
      </div>

      {/* Create Attribute */}
      <div className="rounded-2xl ring-1 ring-slate-200 bg-white p-4 space-y-3">
        <div className="text-lg font-semibold">Add Attribute</div>
        <Field label="Property Row ID" value={attr.propertyId} onChange={(e) => setAttr(v => ({ ...v, propertyId: e.target.value }))} placeholder="properties.id (UUID)" />
        <Field label="Attribute Code" value={attr.code} onChange={(e) => setAttr(v => ({ ...v, code: e.target.value }))} placeholder="door_color, window_color..." />
        <Field label="Attribute Name" value={attr.name} onChange={(e) => setAttr(v => ({ ...v, name: e.target.value }))} placeholder="Color, Material, Type" />
        <button
          disabled={creating}
          onClick={() => run(upsertAttribute, attr, "Attribute saved")}
          className="w-full rounded-xl px-4 py-2 text-white font-medium disabled:opacity-50"
          style={{ backgroundColor: BRAND.primary }}
        >
          Upsert Attribute
        </button>
      </div>

      {/* Create Attribute Value */}
      <div className="md:col-span-2 rounded-2xl ring-1 ring-slate-200 bg-white p-4 space-y-3">
        <div className="text-lg font-semibold">Add Attribute Value</div>
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Attribute Row ID" value={val.attributeId} onChange={(e) => setVal(v => ({ ...v, attributeId: e.target.value }))} placeholder="attributes.id (UUID)" />
          <Field label="Value Code" value={val.code} onChange={(e) => setVal(v => ({ ...v, code: e.target.value }))} placeholder="white, charcoal, wood..." />
          <Field label="Label" value={val.label} onChange={(e) => setVal(v => ({ ...v, label: e.target.value }))} placeholder="White, Charcoal, Wood" />
          <Field label="Overlay URL" value={val.overlayUrl} onChange={(e) => setVal(v => ({ ...v, overlayUrl: e.target.value }))} placeholder="https://.../overlay.png" />
          <Field label="Layer (number)" value={val.layer} onChange={(e) => setVal(v => ({ ...v, layer: Number(e.target.value || 0) }))} />
          <Field label="Price (USD)" value={val.price} onChange={(e) => setVal(v => ({ ...v, price: Number(e.target.value || 0) }))} />
          <Field label="Opacity (0..1, optional)" value={val.opacity} onChange={(e) => setVal(v => ({ ...v, opacity: e.target.value === "" ? "" : Number(e.target.value) }))} />
          <Field label="Blend (css value, optional)" value={val.blend} onChange={(e) => setVal(v => ({ ...v, blend: e.target.value }))} placeholder="multiply, screen..." />
        </div>
        <button
          disabled={creating}
          onClick={() => run(upsertAttributeValue, {
            ...val,
            opacity: val.opacity === "" ? null : Number(val.opacity)
          }, "Attribute value saved")}
          className="w-full rounded-xl px-4 py-2 text-white font-medium disabled:opacity-50"
          style={{ backgroundColor: BRAND.primary }}
        >
          Upsert Value
        </button>
        {msg && <div className="text-sm mt-2" style={{ color: BRAND.muted }}>{msg}</div>}
      </div>
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
