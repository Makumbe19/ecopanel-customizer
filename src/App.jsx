// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown, ChevronRight, Paintbrush, DoorOpen, Layers, Image as ImageIcon,
  Loader2, Menu, X, Phone, Mail, LayoutGrid, ArrowRight, Download, Info, Store, Ruler, FileText, LogOut, ArrowLeft
} from "lucide-react";

import {
  fetchBuilds, fetchBuildRooms,
  upsertLead, createQuote,
  listLeads, listQuotes,
  isValidEmail, signInAdmin, signOutAdmin, isCurrentUserAdmin
} from "./api/supaApi";

// Landing thumbnails (use your storage assets)
import buildAImg from "./assets/builds/build_a/base.jpg";
import buildBImg from "./assets/builds/build_b/base.jpg";
import buildCImg from "./assets/builds/build_c/base.jpg";

// Floorplan images per build (predefined; no upload by client)
import buildAPlan from "./assets/builds/build_a/floorplan.jpg";
import buildBPlan from "./assets/builds/build_b/floorplan.jpg";
import buildCPlan from "./assets/builds/build_c/floorplan.jpg";

const BUILD_FLOORPLAN = {
  build_a: buildAPlan,
  build_b: buildBPlan,
  build_c: buildCPlan,
};

const BRAND = { primary: "#9EC13F", muted: "#848B97" };
const LOGO_URL = "https://ecopanel.co.zw/wp-content/uploads/2021/07/Ecopanel_Logo_FCol_RDRW.png";

const currency = (n) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });
const cls = (...c) => c.filter(Boolean).join(" ");

/* ─────────── helpers ─────────── */
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
    name === "base" ? "base1"
      : /(^|[^a-z])base($|[^0-9a-z])/i.test(name) ? name.replace(/base/i, "base1")
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
                placeholder="quotes@ecopanel.co.zw"
                className="mt-1 w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2"
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
                placeholder="e.g. +263 778 346 123"
                className="mt-1 w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2"
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

/* ---------------- Header (Admin hidden) ---------------- */
function Header() {
  const [open, setOpen] = useState(false);
  const NavItem = ({ to, label }) => (
    <NavLink
      to={to}
      onClick={() => setOpen(false)}
      className={({ isActive }) =>
        cls(
          "px-3 py-2 rounded-lg transition",
          isActive ? "bg-black text-white" : "hover:bg-black/10"
        )
      }
    >
      {label}
    </NavLink>
  );
  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <img src={LOGO_URL} alt="Ecopanel" className="h-7" />
          <span className="font-semibold tracking-wide">Ecopanel</span>
        </Link>
        <nav className="hidden md:flex items-center gap-2">
          <NavItem to="/" label="Home" />
          <NavItem to="/about" label="About" />
          <NavItem to="/commercials" label="Commercials" />
        </nav>
        <button onClick={() => setOpen((v) => !v)} className="md:hidden p-2 rounded-lg hover:bg-black/10">
          {open ? <X /> : <Menu />}
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            className="md:hidden overflow-hidden border-t"
          >
            <div className="px-4 py-3 space-y-2">
              <NavLink to="/" onClick={() => setOpen(false)} className="block px-3 py-2 rounded hover:bg-black/10">Home</NavLink>
              <NavLink to="/about" onClick={() => setOpen(false)} className="block px-3 py-2 rounded hover:bg-black/10">About</NavLink>
              <NavLink to="/commercials" onClick={() => setOpen(false)} className="block px-3 py-2 rounded hover:bg-black/10">Commercials</NavLink>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

/* ---------------- Size Grid ---------------- */
const BUILD_SIZE_PRESETS = [
  { code: "S", label: "Single • 35 m²" },
  { code: "M", label: "Medium • 45 m²" },
  { code: "L", label: "Large • 55 m²" },
  { code: "XXL", label: "Extra Large • 65 m²" },
  { code: "2XL", label: "Extra Large • 67 m²" },
  { code: "3XL", label: "Extra Large • 70 m²" },
  { code: "4XL", label: "Extra Large • 90 m²" },
  { code: "5XL", label: "Extra Large • 120 m²" },
];

function SizeGrid({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {BUILD_SIZE_PRESETS.map((s) => (
        <button
          key={s.code}
          onClick={() => onChange(s)}
          className={cls(
            "rounded-2xl border p-4 text-left transition group",
            value?.code === s.code
              ? "border-black bg-black text-white"
              : "border-slate-300 hover:border-slate-500 bg-white"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold">{s.code}</span>
            <LayoutGrid className="opacity-70" />
          </div>
          <div className="mt-2 text-sm text-slate-600">{s.label}</div>
        </button>
      ))}
    </div>
  );
}

/* ---------------- Viewer (used in customizer & summary) ---------------- */
function Viewer({ room, overlays, className }) {
  const isMobile = useIsMobile();
  const baseUrl = room?.images?.base || room?.baseImage || "";
  const base1Url = room?.images?.base1 || derive1Variant(baseUrl);
  const pickInitial = () => (isMobile ? (base1Url || baseUrl) : baseUrl);
  const [bgSrc, setBgSrc] = useState(pickInitial);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setLoading(true); setBgSrc(pickInitial()); /* eslint-disable-next-line */ }, [room.id, isMobile]);
  useEffect(() => { setLoading(true); /* eslint-disable-next-line */ }, [overlays.map(o => `${o.key}:${o.url}:${o.url1}`).join(",")]);

  return (
    <div className={cls("relative w-full h-full overflow-hidden", className)}>
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

      <img
        src={bgSrc}
        alt={`${room.domain} ${room.type}`}
        className="absolute inset-0 h-full w-full object-cover select-none"
        draggable={false}
        onLoad={() => setTimeout(() => setLoading(false), 120)}
        onError={() => { if (bgSrc !== baseUrl) setBgSrc(baseUrl || bgSrc); else setLoading(false); }}
      />

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
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/10 to-transparent z-30" />
    </div>
  );
}

/* helper to compute overlays for ANY room + selections */
function overlaysForRoom(room, selections) {
  const items = [];
  const rSel = selections?.[room.id] || {};
  for (const prop of room.properties) {
    const pSel = rSel[prop.id] || {};
    for (const attr of prop.attributes) {
      const vId = pSel[attr.id];
      const v = attr.values.find((vv) => vv.id === vId);
      if (v?.overlayUrl || v?.overlayUrl1) {
        items.push({
          key: `${prop.id}:${attr.id}`,
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
}

/* ---------------- Customizer ---------------- */
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
  return { basePrice, optionsSubtotal, grandTotal: basePrice + optionsSubtotal, items };
}

/* ---------------- Full-screen customizer page ---------------- */
function Customizer({ build, lead, onBack, rooms, onCustomizerStateChange }) {
  const navigate = useNavigate();

  const [activeRoomId, setActiveRoomId] = useState(rooms[0]?.id);
  const activeRoom = useMemo(() => rooms.find((r) => r.id === activeRoomId), [rooms, activeRoomId]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selections, setSelections] = useState({});
  const [quoteMsg, setQuoteMsg] = useState("");

  useEffect(() => { onCustomizerStateChange?.(true); return () => onCustomizerStateChange?.(false); }, [onCustomizerStateChange]);
  useEffect(() => { try { if (window.innerWidth >= 1024) setDrawerOpen(true); } catch { } }, []);

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
  }, [selections, activeRoomId, key, lead]);

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

  const overlays = useMemo(() => overlaysForRoom(activeRoom, selections), [activeRoom, selections]);

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

  const pricing = useMemo(
    () => computePricing({ rooms, selections, basePrice: build.basePrice || 0 }),
    [rooms, selections, build.basePrice]
  );

  const downloadQuoteSummary = () => {
    const payload = {
      build: {
        id: build.id, name: build.name, sizeSqm: build.sizeSqm,
        bedrooms: build.bedrooms, bathrooms: build.bathrooms, basePrice: build.basePrice || 0,
        sizePreset: build.sizePreset || null,
      },
      lead, selections, summary, pricing, rooms,
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

  const goToSummary = () => {
    const snapshot = {
      build: { ...build },
      lead: { ...lead },
      selections,
      rooms,
      pricing,
      summary,
    };
    try { sessionStorage.setItem("ecopanel:lastSummary", JSON.stringify(snapshot)); } catch { }
    navigate("/summary", { state: snapshot });
  };

  const requestQuote = async () => {
    setQuoteMsg("");
    if (!lead?.id) {
      setQuoteMsg("Please enter your details first.");
      return;
    }
    try {
      await createQuote({ buildId: build.id, leadId: lead.id, selections, pricing });
      setQuoteMsg("Thanks! Your quotation has been emailed.");
      goToSummary();
    } catch (e) {
      console.error("createQuote failed:", e);
      setQuoteMsg("Could not submit quote right now. Saved a local copy instead.");
      downloadQuoteSummary();
      goToSummary();
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
    <div className="relative h-[calc(100vh-0px)] w-full">
      {/* Floating Back (header hidden while customizing) */}
      <button
        onClick={onBack}
        className="fixed left-3 top-3 z-40 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur ring-1 ring-black/10 hover:bg-white"
        title="Back"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Back</span>
      </button>

      {/* Full-screen viewer */}
      <div className="absolute inset-0 z-0">
        <Viewer room={activeRoom} overlays={overlays} />
      </div>

      {/* Room rail */}
      <div className="flex fixed right-2 top-16 sm:right-3 md:right-4 z-30 flex-col gap-2">
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
              className="fixed left-0 top-0 bottom-0 z-30 w-full max-w-[380px] md:max-w-[420px] bg-white ring-1 ring-slate-200 shadow-2xl overflow-y-auto"
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

/* ---------------- Home container (Lead → size grid → floorplan → customize) ---------------- */
function HomeContainer({ onCustomizerStateChange }) {
  const [builds, setBuilds] = useState([]);
  const [step, setStep] = useState("landing");
  const [lead, setLead] = useState(null);
  const [selectedBuild, setSelectedBuild] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [leadModal, setLeadModal] = useState(false);
  const [sizePreset, setSizePreset] = useState(null);

  const sizeSectionRef = useRef(null);

  useEffect(() => { (async () => setBuilds(await fetchBuilds()))(); }, []);

  const pickBuild = (b) => { setSelectedBuild(b); setLeadModal(true); };

  const handleLeadSubmit = async (data) => {
    try {
      const row = await upsertLead({ email: data.email, phone: data.phone, firstName: data.firstName, lastName: data.lastName });
      setLead({ ...data, id: row.id });
    } catch (err) {
      console.error("upsertLead failed:", err);
      setLead(data);
    } finally {
      setLeadModal(false);
      setTimeout(() => { try { sizeSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); } catch { } }, 50);
    }
  };

  const proceedToCustomize = async () => {
    if (!selectedBuild) return;
    const fetched = await fetchBuildRooms(selectedBuild.id); // API enforces folder/rule mapping
    setRooms(fetched || []);
    setStep("customizer");
  };

  if (step === "customizer" && selectedBuild && rooms.length > 0) {
    return (
      <Customizer
        build={{ ...selectedBuild, sizePreset }}
        lead={lead}
        rooms={rooms}
        onBack={() => { setStep("landing"); onCustomizerStateChange?.(false); }}
        onCustomizerStateChange={onCustomizerStateChange}
      />
    );
  }

  return (
    <>
      <Landing builds={builds} onPick={pickBuild} />

      {selectedBuild && lead && (
        <section className="max-w-6xl mx-auto px-4 pb-10" ref={sizeSectionRef}>
          <div className="rounded-3xl bg-white ring-1 ring-slate-200 p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-grid place-items-center w-5 h-5 rounded bg-slate-900 text-white text-[10px]">2</span>
              <div className="font-semibold">Choose Size & Review Floorplan</div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <div className="text-sm mb-2" style={{ color: BRAND.muted }}>Select a size</div>
                <SizeGrid value={sizePreset} onChange={setSizePreset} />
              </div>

              <div>
                <div className="text-sm mb-2" style={{ color: BRAND.muted }}>Floorplan for this build</div>
                <div className="rounded-2xl overflow-hidden border border-slate-200">
                  <img
                    src={BUILD_FLOORPLAN[selectedBuild.id] || buildAPlan}
                    alt={`${selectedBuild.name} floorplan`}
                    className="w-full h-auto object-contain"
                  />
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  Note: Floorplan is fixed per build. Size changes only affect exterior dimensions and room sizes.
                </div>
              </div>
            </div>

            <div className="mt-5">
              <button
                onClick={proceedToCustomize}
                disabled={!sizePreset}
                className={cls(
                  "inline-flex items-center gap-2 px-4 py-2 rounded-xl transition",
                  sizePreset ? "bg-black text-white" : "bg-black/20 text-black/50 cursor-not-allowed"
                )}
              >
                Proceed to customizations <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </section>
      )}

      <LeadCaptureModal
        open={leadModal}
        onSubmit={handleLeadSubmit}
        onClose={() => setLeadModal(false)}
        validateEmail={isValidEmail}
      />
    </>
  );
}

/* ---------------- Landing Page ---------------- */
function Landing({ builds, onPick }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
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

/* ---------------- Summary Page (after quote) ---------------- */
function SummaryPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const state = location.state || (() => {
    try { return JSON.parse(sessionStorage.getItem("ecopanel:lastSummary") || "null"); } catch { return null; }
  })();

  if (!state) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="rounded-2xl border bg-white p-6">
          <div className="text-slate-700">No summary to show yet.</div>
          <button onClick={() => navigate("/")} className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black text-white">
            <ArrowLeft size={16} /> Back to Home
          </button>
        </div>
      </div>
    );
  }

  const { build, lead, selections, rooms, pricing, summary } = state;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-semibold">Your Quote Summary</h1>
        <button onClick={() => navigate("/")} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200">
          <ArrowLeft size={16} /> Back to Home
        </button>
      </div>

      {/* Lead + Build */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-slate-500 mb-1">Customer</div>
          <div className="font-medium">{lead?.firstName} {lead?.lastName}</div>
          <div className="text-sm text-slate-600">{lead?.email} • {lead?.phone}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-slate-500 mb-1">Build</div>
          <div className="font-medium">{build?.name}</div>
          <div className="text-sm text-slate-600">
            {build?.sizeSqm} m² • {build?.bedrooms} bed • {build?.bathrooms} bath {build?.sizePreset ? `• ${build.sizePreset.label}` : ""}
          </div>
        </div>
      </div>

      {/* Specs */}
      <div className="rounded-2xl border bg-white p-4 mt-4">
        <div className="text-sm text-slate-500 mb-2">Selections</div>
        {(!summary || summary.length === 0) ? (
          <div className="text-slate-600 text-sm">No selections made.</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {summary.map((group) => (
              <div key={group.room} className="rounded-xl border p-3">
                <div className="font-medium">{group.room}</div>
                <ul className="mt-2 text-sm space-y-1">
                  {group.items.map((it, i) => (
                    <li key={i} className="text-slate-700">
                      {it.property} → {it.attribute}: <span className="font-medium">{it.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Renders grid for all rooms */}
      <div className="mt-6">
        <div className="text-sm text-slate-500 mb-2">Customized Renders</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room) => (
            <div key={room.id} className="rounded-2xl overflow-hidden border bg-white">
              <div className="w-full aspect-[9/16] md:aspect-[16/10]">
                <Viewer room={room} overlays={overlaysForRoom(room, selections)} className="h-full" />
              </div>
              <div className="px-3 py-2 text-sm text-slate-700 border-t">
                {room.domain} • {room.type}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="mt-6 rounded-2xl border bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-slate-600">Base:</div>
          <div className="font-semibold">{currency(pricing?.basePrice || 0)}</div>
          <div className="text-slate-300">•</div>
          <div className="text-slate-600">Options:</div>
          <div className="font-semibold">{currency(pricing?.optionsSubtotal || 0)}</div>
          <div className="text-slate-300">•</div>
          <div className="text-slate-600">Grand Total:</div>
          <div className="text-xl font-bold">{currency(pricing?.grandTotal || 0)}</div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- About & Commercials ---------------- */
function AboutPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="rounded-3xl border border-slate-200 p-6 bg-white">
        <div className="flex items-center gap-3 mb-4">
          <Info />
          <h1 className="text-2xl font-semibold">About Ecopanel</h1>
        </div>
        <p className="text-slate-700 leading-7">
          Ecopanel designs modular, energy-efficient spaces built for speed, value, and sustainability.
          Our A, B, and C series deliver modern finishes and configurable layouts for homes, offices, and retail.
        </p>
        <div className="grid md:grid-cols-3 gap-4 mt-6">
          <div className="rounded-2xl border border-slate-200 p-4">
            <Ruler className="opacity-70" />
            <div className="font-semibold mt-2">Precision</div>
            <div className="text-sm text-slate-600">Factory-grade tolerances and panel systems.</div>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <FileText className="opacity-70" />
            <div className="font-semibold mt-2">Compliance</div>
            <div className="text-sm text-slate-600">Built for longevity and low maintenance.</div>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <Store className="opacity-70" />
            <div className="font-semibold mt-2">Support</div>
            <div className="text-sm text-slate-600">Local service, clear quotes, fast delivery.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
function CommercialsPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="rounded-3xl border border-slate-200 p-6 bg-white">
        <div className="flex items-center gap-3 mb-4">
          <Store />
          <h1 className="text-2xl font-semibold">Commercials</h1>
        </div>
        <p className="text-slate-700 leading-7">
          Need pricing and scope? Tell us your desired size and finishes—we’ll generate a structured quote with
          lead times and optional upgrades. Bulk and developer rates available.
        </p>
        <ul className="list-disc list-inside mt-4 text-slate-700 space-y-1">
          <li>Series pricing by size (Single, Medium, Large, XL)</li>
          <li>Wardrobe textures (grey, walnut, white) and floor options</li>
          <li>Add-ons (decks, canopies, solar prep)</li>
        </ul>
      </div>
    </div>
  );
}

/* ---------------- Thin footer (ALWAYS SHOWN, even in Customizer) ---------------- */
function Footer() {
  return (
    <footer className="border-t">
      <div className="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between text-sm">
        <span className="text-slate-500">© {new Date().getFullYear()} Ecopanel</span>
        <span className="inline-flex items-center gap-3 text-slate-600">
          <span className="hidden sm:inline-flex items-center gap-1"><Phone size={16} /> +263 778 346 960</span>
          <span className="text-slate-300 hidden sm:inline">|</span>
          <span className="inline-flex items-center gap-1"><Mail size={16} /> quotes@ecopanel.co.zw</span>
        </span>
      </div>
    </footer>
  );
}

/* ---------------- Admin gate + panel (quotes & leads) ---------------- */
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
      <div className="min-h-[70vh] grid place-items-center p-4">
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
function AdminPanel() {
  const [tab, setTab] = useState("quotes"); // "quotes" | "leads"
  const [leads, setLeads] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true); setErr("");
      try {
        const [L, Q] = await Promise.all([listLeads(), listQuotes()]);
        setLeads(L || []); setQuotes(Q || []);
      } catch (e) {
        setErr(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const pill = (active) =>
    `px-3 py-1 rounded-xl border ${active ? "bg-black text-white border-black" : "bg-white hover:bg-slate-50 border-slate-300"}`;

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

      <div className="flex gap-2 mb-3">
        <button onClick={() => setTab("quotes")} className={pill(tab === "quotes")}>Quotes</button>
        <button onClick={() => setTab("leads")} className={pill(tab === "leads")}>Leads</button>
      </div>

      {err && <div className="mb-3 text-sm text-red-600">{err}</div>}

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
      ) : (
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
      )}
    </div>
  );
}

/* ---------------- Root with routes + ?admin=1 switch ----------------
   Header is hidden while customizing; Footer is ALWAYS shown (per your request) */
function AppShell() {
  const [inCustomizer, setInCustomizer] = useState(false);
  const isAdmin =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("admin") === "1";

  return (
    <div className="min-h-screen bg-slate-50">
      {!inCustomizer && <Header />}
      {isAdmin ? (
        <AdminGate><AdminPanel /></AdminGate>
      ) : (
        <Routes>
          <Route path="/" element={<HomeContainer onCustomizerStateChange={setInCustomizer} />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/commercials" element={<CommercialsPage />} />
          <Route path="/summary" element={<SummaryPage />} />
        </Routes>
      )}
      {/* Footer is now ALWAYS visible, including in customizer */}
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
