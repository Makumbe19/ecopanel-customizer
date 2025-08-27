// src/api/supaApi.js
import { supabase } from "../lib/supabaseClient";

/* ───────────────────────────── utilities ───────────────────────────── */

export function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || "").trim());
}

const STORAGE_BUCKET = "ECOPANEL";

/** Join path segments cleanly */
function joinPath(...parts) {
    return parts
        .filter(Boolean)
        .map(String)
        .join("/")
        .replace(/\/{2,}/g, "/")
        .replace(/^\/+/, "");
}

/** dirname("a/b/c.png") -> "a/b" */
function dirname(p) {
    const m = String(p || "").match(/^(.*)\/[^/]*$/);
    return m ? m[1] : "";
}

/** Remove stray/duplicate prefixes and normalize slashes. */
function normalizeDbPath(p) {
    if (!p) return null;
    let path = String(p).trim();

    // Strip bucket name or "public/ECOPANEL/" if someone stored full object path
    path = path.replace(/^public\/?ECOPANEL\/?/i, "");
    path = path.replace(/^ECOPANEL\/?/i, "");

    // Normalize bathroom vs bath naming if it appears in DB
    path = path.replace(/\/bathroom\//gi, "/bath/");

    // Remove leading slashes & collapse duplicates
    path = path.replace(/^\/+/, "").replace(/\/{2,}/g, "/");

    // Many rows are "builds/..." but your storage has "assets/builds/..."
    if (!/^assets\//i.test(path)) {
        path = `assets/${path}`;
    }

    // Avoid "assets/assets/..."
    path = path.replace(/^assets\/assets\//i, "assets/");

    return path;
}

/** Turn a (possibly DB-ish) path into a Public URL in ECOPANEL bucket. */
function toStorageUrl(pathLike) {
    const key = normalizeDbPath(pathLike);
    if (!key) return null;
    if (/^https?:\/\//i.test(key)) return key; // already a URL
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(key);
    return data?.publicUrl || null;
}

/** Build a best-guess path for overlays based on the room's base_image folder. */
function resolveOverlayPath({ roomBaseImage, rawOverlay }) {
    if (!rawOverlay) return null;
    // If it already has a folder or is a full URL, just use it.
    if (rawOverlay.includes("/") || /^https?:\/\//i.test(rawOverlay)) {
        return normalizeDbPath(rawOverlay);
    }
    // Fallback: put it next to the base image of the room
    const baseDir = dirname(normalizeDbPath(roomBaseImage));
    if (!baseDir) return null;
    return joinPath(baseDir, rawOverlay);
}

/** Derive *1 filename variant for URLs or storage paths.
 *  e.g. ".../walnut.png?x=y" -> ".../walnut1.png?x=y"
 *       ".../base.jpg" -> ".../base1.jpg"
 */
function derive1Variant(urlOrPath) {
    if (!urlOrPath) return "";

    const qIndex = urlOrPath.indexOf("?");
    const noQS = qIndex >= 0 ? urlOrPath.slice(0, qIndex) : urlOrPath;
    const qs = qIndex >= 0 ? urlOrPath.slice(qIndex) : "";

    const lastSlash = noQS.lastIndexOf("/");
    const lastDot = noQS.lastIndexOf(".");
    const dir = lastSlash >= 0 ? noQS.slice(0, lastSlash + 1) : "";
    const name = noQS.slice(lastSlash + 1, lastDot >= 0 ? lastDot : undefined);
    const ext = lastDot >= 0 ? noQS.slice(lastDot) : "";

    // If the name is exactly "base" we want "base1"
    // Otherwise replace the first 'base' token, else append '1'
    const newName =
        name === "base"
            ? "base1"
            : /(^|[^a-z])base($|[^0-9a-z])/i.test(name)
                ? name.replace(/base/i, "base1")
                : name + "1";

    return dir + newName + ext + qs;
}

/* ───────────────────────────── auth (admin) ───────────────────────────── */

export async function signInAdmin({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}

export async function signOutAdmin() {
    await supabase.auth.signOut();
}

export async function isCurrentUserAdmin() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    try {
        const { data, error } = await supabase
            .from("admins")
            .select("user_id")
            .eq("user_id", user.id)
            .maybeSingle();
        if (error) return false;
        return !!data;
    } catch {
        return false;
    }
}

/* ───────────────────────────── builds ───────────────────────────── */

export async function fetchBuilds() {
    const { data, error } = await supabase
        .from("builds")
        .select("id, name, size_sqm, bedrooms, bathrooms, base_price")
        .order("size_sqm", { ascending: true });

    if (error) throw error;

    return (data || []).map((b) => ({
        id: b.id,
        name: b.name,
        sizeSqm: b.size_sqm,
        bedrooms: b.bedrooms,
        bathrooms: b.bathrooms,
        basePrice: Number(b.base_price || 0),
    }));
}

/* ───────────────── rooms + properties + attributes + values ────────────── */

export async function fetchBuildRooms(buildId) {
    // rooms
    const { data: rooms, error: rErr } = await supabase
        .from("rooms")
        .select("id, domain, type, base_image")
        .eq("build_id", buildId);

    if (rErr) throw rErr;
    if (!rooms?.length) return [];

    const roomIds = rooms.map((r) => r.id);

    // properties
    const { data: props, error: pErr } = await supabase
        .from("properties")
        .select("id, room_id, code, name")
        .in("room_id", roomIds);
    if (pErr) throw pErr;

    const propIds = props.map((p) => p.id);

    // attributes
    const { data: attrs, error: aErr } = await supabase
        .from("attributes")
        .select("id, property_id, code, name")
        .in("property_id", propIds);
    if (aErr) throw aErr;

    const attrIds = attrs.map((a) => a.id);

    // values
    const { data: vals, error: vErr } = await supabase
        .from("attribute_values")
        .select("id, attribute_id, code, label, overlay_url, layer, price, opacity, blend")
        .in("attribute_id", attrIds);
    if (vErr) throw vErr;

    // groupings
    const propsByRoom = props.reduce((m, p) => ((m[p.room_id] ||= []).push(p), m), {});
    const attrsByProp = attrs.reduce((m, a) => ((m[a.property_id] ||= []).push(a), m), {});
    const valsByAttr = vals.reduce((m, v) => ((m[v.attribute_id] ||= []).push(v), m), {});

    // build output
    const out = rooms.map((r) => {
        const baseImageUrl = toStorageUrl(r.base_image);
        const base1Url = baseImageUrl ? derive1Variant(baseImageUrl) : null;

        return {
            id: r.id,
            domain: r.domain, // "Exterior" | "Interior"
            type: r.type,     // "Front" | "Kitchen" | "Bedroom" | "Bathroom"
            // backward-compat for existing UI
            baseImage: baseImageUrl,
            // explicit variants for desktop/mobile consumers
            images: {
                base: baseImageUrl,
                base1: base1Url,
            },
            properties: (propsByRoom[r.id] || []).map((p) => ({
                id: p.code,
                name: p.name,
                attributes: (attrsByProp[p.id] || []).map((a) => ({
                    id: a.code,
                    name: a.name,
                    values: (valsByAttr[a.id] || []).map((v) => {
                        const overlayPath = resolveOverlayPath({
                            roomBaseImage: r.base_image,
                            rawOverlay: v.overlay_url,
                        });
                        const overlayPath1 = overlayPath ? derive1Variant(overlayPath) : null;

                        return {
                            id: v.code,
                            label: v.label,
                            // keep original single URL for backward-compat (desktop)
                            overlayUrl: overlayPath ? toStorageUrl(overlayPath) : null,
                            // NEW: mobile variant (derived)
                            overlayUrl1: overlayPath1 ? toStorageUrl(overlayPath1) : null,
                            layer: typeof v.layer === "number" ? v.layer : 0,
                            price: Number(v.price || 0),
                            opacity: v.opacity,
                            blend: v.blend || null,
                        };
                    }),
                })),
            })),
        };
    });

    // Preferred UI order:
    const rank = (room) => {
        const { domain, type } = room;
        if (domain === "Exterior" && type === "Front") return 0;
        if (domain === "Interior" && type === "Kitchen") return 1;
        if (domain === "Interior" && type === "Bedroom") return 2;
        if (domain === "Interior" && type === "Bathroom") return 3;
        return 9;
    };
    out.sort((a, b) => rank(a) - rank(b));

    return out;
}

/* ───────────────────────────── leads (robust upsert) ────────────────────── */

export async function upsertLead({ email, phone, firstName, lastName }) {
    const e = String(email || "").trim().toLowerCase();
    const p = String(phone || "").trim();

    if (!isValidEmail(e)) throw new Error("Invalid email address");
    if (!p) throw new Error("Phone is required");

    const payload = {
        email: e,
        phone: p,
        first_name: (firstName || "").trim() || null,
        last_name: (lastName || "").trim() || null,
        updated_at: new Date().toISOString(),
    };

    // First try to upsert by email (many projects use this as the unique key)
    let res = await supabase
        .from("leads")
        .upsert(payload, { onConflict: "email" })
        .select("id")
        .single();

    // If we hit duplicate phone (23505 on "leads_phone_key"), resolve by phone
    if (res.error && res.error.code === "23505" && /leads_phone_key/i.test(res.error.message || "")) {
        const byPhone = await supabase
            .from("leads")
            .select("id")
            .eq("phone", p)
            .maybeSingle();

        if (byPhone?.data?.id) {
            const upd = await supabase
                .from("leads")
                .update(payload)
                .eq("id", byPhone.data.id)
                .select("id")
                .single();
            if (upd.error) throw upd.error;
            return upd.data;
        }
        throw res.error;
    }

    if (res.error) {
        throw res.error;
    }
    return res.data; // { id }
}

/* ───────────────────────────── quotes ───────────────────────────── */

export async function createQuote({ buildId, leadId, selections, pricing }) {
    // Preferred path: SECURITY DEFINER RPC (if you created it)
    const rpc = await supabase.rpc("create_quote_json", {
        p_lead_id: leadId,
        p_build_id: buildId,
        p_selections: selections,
        p_pricing: pricing,
    });

    if (!rpc.error && rpc.data) {
        try {
            await supabase.functions.invoke("email-quote", {
                body: { quoteId: rpc.data, leadId, buildId, pricing },
            });
        } catch {
            // soft-fail
        }
        return { id: rpc.data };
    }

    // Fallback: direct insert (requires RLS to allow it)
    const ins = await supabase
        .from("quotes")
        .insert({
            build_id: buildId,
            lead_id: leadId,
            selections,
            pricing,
        })
        .select("id")
        .single();

    if (ins.error) throw ins.error;

    try {
        await supabase.functions.invoke("email-quote", {
            body: { quoteId: ins.data.id, leadId, buildId, pricing },
        });
    } catch {
        // soft-fail
    }

    return { id: ins.data.id };
}

/* ───────────────────────────── admin data ───────────────────────────── */

export async function listLeads() {
    const { data, error } = await supabase
        .from("leads")
        .select("id, first_name, last_name, email, phone, updated_at, inserted_at, created_at")
        .order("updated_at", { ascending: false });

    if (error) throw error;
    return data || [];
}

export async function listQuotes() {
    const { data, error } = await supabase
        .from("quotes")
        .select("id, build_id, lead_id, pricing, created_at, emailed_at")
        .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
}
