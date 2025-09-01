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

/** Normalize DB-ish storage paths to ECOPANEL/public format */
function normalizeDbPath(p) {
    if (!p) return null;
    let path = String(p).trim();

    // Strip bucket name or "public/ECOPANEL/"
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

/** Derive *1 mobile filename variant for URLs or storage paths. */
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
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });
    if (error) throw error;
    return data;
}

export async function signOutAdmin() {
    await supabase.auth.signOut();
}

export async function isCurrentUserAdmin() {
    const {
        data: { user },
    } = await supabase.auth.getUser();
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
/* EXACT business rules you requested, applied uniformly across series */

const ALIASES = {
    roof: /^roof/i,
    siding_material: /siding[_-]?material|cladding|cladding_material/i,
    siding_color: /siding[_-]?color|cladding[_-]?color/i,
    door_material: /door[_-]?material/i,
    door_color: /door[_-]?color/i,
    window_material: /window[_-]?material/i,
    window_color: /window[_-]?color/i,
    floor_material: /floor[_-]?material|floor(type)?/i,
    floor_texture: /floor[_-]?texture/i,
    countertop_material: /counter(top)?[_-]?material|counter(top)?/i,
    countertop_color: /counter(top)?[_-]?color/i,
    shower: /shower/i,
    vanity: /vanity/i,
    toilet_type: /toilet[_-]?type/i,
    wardrobe_texture: /wardrobe[_-]?texture/i,
};

const KEEP_SETS = {
    // Roof: color only
    ROOF_COLOR: ["green", "charcoal_grey", "charcoalgrey", "charcoal"],
    // Siding
    SIDING_MATERIAL: [
        "timberclading",   // (common misspelling)
        "timber_cladding",
        "timbercladding",
        "timber",
        "bagwash",
        "bag_wash",
    ],
    SIDING_COLOR: ["grey", "white", "black"],
    // Doors
    DOOR_MATERIAL: ["teak", "aluminium", "aluminum", "wood"],
    DOOR_COLOR: ["white", "grey", "black"],
    // Windows: colors only
    WINDOW_COLOR: ["charcoal_grey", "charcoalgrey", "charcoal", "black"],
    // Floors
    FLOOR_MATERIAL: ["tile", "tiles", "laminate"],
    FLOOR_TEXTURE: ["grey", "white", "walnut"],
    // Countertops: material only
    COUNTERTOP_MATERIAL: ["granite", "postfoam", "post_form", "postform"],
};

function codeNorm(s) {
    return String(s || "")
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/-/g, "_");
}
function labelFor(code, fallback) {
    const map = {
        charcoal_grey: "Charcoal Grey",
        timbercladding: "Timber Cladding",
        timber_cladding: "Timber Cladding",
        postfoam: "Postform",
        post_form: "Postform",
    };
    return (
        map[code] ||
        fallback ||
        String(code || "")
            .replace(/_/g, " ")
            .replace(/\b\w/g, (m) => m.toUpperCase())
    );
}
function matches(idOrName, rx) {
    if (!rx) return false;
    const s = String(idOrName || "");
    return rx.test(s) || rx.test(codeNorm(s));
}
function filterValues(values, allowedSet) {
    const keep = new Set(allowedSet.map(codeNorm));
    return values
        .map((v) => ({
            ...v,
            _normCode: codeNorm(v.id || v.code || v.label),
        }))
        .filter((v) => keep.has(v._normCode))
        .map((v) => ({
            ...v,
            label: labelFor(v._normCode, v.label),
            id: v.id || v.code || v._normCode,
        }));
}
function filterOrKeep(values, allowedSet) {
    const filtered = filterValues(values, allowedSet);
    return filtered.length ? filtered : values;
}
function removeAttributesByRegex(attributes, rxList) {
    return attributes.filter(
        (a) => !rxList.some((rx) => matches(a.id, rx) || matches(a.name, rx))
    );
}
function keepOnlyAttributes(attributes, rxList) {
    return attributes.filter((a) =>
        rxList.some((rx) => matches(a.id, rx) || matches(a.name, rx))
    );
}

/** Clamp/reshape options exactly to your catalog rules */
function applyBusinessRulesToRoom({ room }) {
    const isBathroom = /bath/i.test(room.type || "");
    const isExterior = /exterior/i.test(room.domain || "");

    // Deep-ish clone to avoid mutating the raw arrays
    const newRoom = {
        ...room,
        properties: room.properties.map((p) => ({
            ...p,
            attributes: p.attributes.map((a) => ({
                ...a,
                values: a.values.map((v) => ({ ...v })),
            })),
        })),
    };

    // FLOORS (everywhere): material (Tiles/Laminate) + texture (Grey/White/Walnut)
    for (const prop of newRoom.properties) {
        if (/floor|flooring/i.test(prop.id) || /floor|flooring/i.test(prop.name)) {
            for (const attr of prop.attributes) {
                // material/type
                if (/material|type/i.test(attr.id) || /material|type/i.test(attr.name)) {
                    attr.values = filterOrKeep(attr.values, KEEP_SETS.FLOOR_MATERIAL);
                }
                // texture/finish/color/colour
                if (
                    /texture|finish|color|colour/i.test(attr.id) ||
                    /texture|finish|color|colour/i.test(attr.name)
                ) {
                    attr.values = filterOrKeep(attr.values, KEEP_SETS.FLOOR_TEXTURE);
                }
            }
        }
    }

    // COUNTERTOPS (everywhere): MATERIAL ONLY (granite/postfoam); remove color
    for (const prop of newRoom.properties) {
        if (
            matches(prop.id, ALIASES.countertop_material) ||
            matches(prop.name, ALIASES.countertop_material)
        ) {
            // strip color attributes
            prop.attributes = removeAttributesByRegex(prop.attributes, [
                ALIASES.countertop_color,
                /color|colour/i,
            ]);
            // clamp material values
            for (const attr of prop.attributes) {
                if (/material|type/i.test(attr.id) || /material|type/i.test(attr.name)) {
                    attr.values = filterOrKeep(attr.values, KEEP_SETS.COUNTERTOP_MATERIAL);
                }
            }
        }
    }

    // BATHROOMS: remove shower & vanity; keep Floor + Toilet (Type only)
    if (isBathroom) {
        let filtered = newRoom.properties.filter(
            (p) =>
                !(
                    matches(p.id, ALIASES.shower) ||
                    matches(p.name, ALIASES.shower) ||
                    matches(p.id, ALIASES.vanity) ||
                    matches(p.name, ALIASES.vanity)
                )
        );

        // keep only floor & toilet
        filtered = filtered.filter(
            (p) =>
                /floor/i.test(p.id) ||
                /floor/i.test(p.name) ||
                /toilet/i.test(p.id) ||
                /toilet/i.test(p.name)
        );

        // Toilet: expose only "type" attribute if present
        filtered = filtered.map((p) => {
            if (/toilet/i.test(p.id) || /toilet/i.test(p.name)) {
                return { ...p, attributes: keepOnlyAttributes(p.attributes, [/type/i]) };
            }
            return p;
        });

        newRoom.properties = filtered;
    }

    // EXTERIOR specifics
    if (isExterior) {
        for (const prop of newRoom.properties) {
            // ROOF: COLOR ONLY (green/charcoal grey) — remove material/type
            if (/roof/i.test(prop.id) || /roof/i.test(prop.name)) {
                prop.attributes = keepOnlyAttributes(prop.attributes, [/color|colour/i]);
                for (const attr of prop.attributes) {
                    attr.values = filterOrKeep(attr.values, KEEP_SETS.ROOF_COLOR);
                }
            }

            // SIDING: materials (timbercladding/bagwash) + colors (grey/white/black)
            if (/siding|cladding/i.test(prop.id) || /siding|cladding/i.test(prop.name)) {
                for (const attr of prop.attributes) {
                    if (/material|type/i.test(attr.id) || /material|type/i.test(attr.name)) {
                        attr.values = filterOrKeep(attr.values, KEEP_SETS.SIDING_MATERIAL);
                    }
                    if (/color|colour/i.test(attr.id) || /color|colour/i.test(attr.name)) {
                        attr.values = filterOrKeep(attr.values, KEEP_SETS.SIDING_COLOR);
                    }
                }
            }

            // DOORS: materials (teak/aluminium/wood) + colors (white/grey/black)
            if (/door/i.test(prop.id) || /door/i.test(prop.name)) {
                for (const attr of prop.attributes) {
                    if (/material|type/i.test(attr.id) || /material|type/i.test(attr.name)) {
                        attr.values = filterOrKeep(attr.values, KEEP_SETS.DOOR_MATERIAL);
                    }
                    if (/color|colour/i.test(attr.id) || /color|colour/i.test(attr.name)) {
                        attr.values = filterOrKeep(attr.values, KEEP_SETS.DOOR_COLOR);
                    }
                }
            }

            // WINDOWS: NO MATERIAL; colors only (charcoal grey/black)
            if (/window/i.test(prop.id) || /window/i.test(prop.name)) {
                prop.attributes = removeAttributesByRegex(prop.attributes, [
                    ALIASES.window_material,
                    /material/i,
                ]);
                for (const attr of prop.attributes) {
                    if (/color|colour/i.test(attr.id) || /color|colour/i.test(attr.name)) {
                        attr.values = filterOrKeep(attr.values, KEEP_SETS.WINDOW_COLOR);
                    }
                }
            }
        }
    }

    // Clean empties
    for (const prop of newRoom.properties) {
        prop.attributes = prop.attributes
            .map((a) => ({ ...a, values: (a.values || []).filter(Boolean) }))
            .filter((a) => (a.values || []).length > 0);
    }
    newRoom.properties = newRoom.properties.filter(
        (p) => (p.attributes || []).length > 0
    );

    return newRoom;
}

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
        .select(
            "id, attribute_id, code, label, overlay_url, layer, price, opacity, blend"
        )
        .in("attribute_id", attrIds);
    if (vErr) throw vErr;

    // groupings
    const propsByRoom = props.reduce(
        (m, p) => ((m[p.room_id] ||= []).push(p), m),
        {}
    );
    const attrsByProp = attrs.reduce(
        (m, a) => ((m[a.property_id] ||= []).push(a), m),
        {}
    );
    const valsByAttr = vals.reduce(
        (m, v) => ((m[v.attribute_id] ||= []).push(v), m),
        {}
    );

    // build output (with desktop + mobile overlay variants)
    const outRaw = rooms.map((r) => {
        const baseImageUrl = toStorageUrl(r.base_image);
        const base1Url = baseImageUrl ? derive1Variant(baseImageUrl) : null;

        return {
            id: r.id,
            domain: r.domain, // "Exterior" | "Interior"
            type: r.type, // "Front" | "Kitchen" | "Bedroom" | "Bathroom"
            baseImage: baseImageUrl,
            images: { base: baseImageUrl, base1: base1Url },
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
                        const overlayUrl = overlayPath ? toStorageUrl(overlayPath) : null;
                        const overlayUrl1 = overlayUrl
                            ? derive1Variant(overlayUrl) // desktop uses overlayUrl; mobile can use *1
                            : overlayPath
                                ? toStorageUrl(derive1Variant(overlayPath))
                                : null;

                        return {
                            id: v.code,
                            label: v.label,
                            overlayUrl,
                            overlayUrl1,
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

    // Apply rules per room
    const out = outRaw.map((room) => applyBusinessRulesToRoom({ room }));

    // Preferred UI order:
    const rank = (room) => {
        const { domain, type } = room;
        if (domain === "Exterior" && /Front/i.test(type)) return 0;
        if (domain === "Interior" && /Kitchen/i.test(type)) return 1;
        if (domain === "Interior" && /Bedroom/i.test(type)) return 2;
        if (domain === "Interior" && /Bath/i.test(type)) return 3;
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

    // First try to upsert by email (commonly unique)
    let res = await supabase
        .from("leads")
        .upsert(payload, { onConflict: "email" })
        .select("id")
        .single();

    // If we hit duplicate phone (23505 on "leads_phone_key"), resolve by phone
    if (
        res.error &&
        res.error.code === "23505" &&
        /leads_phone_key/i.test(res.error.message || "")
    ) {
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
    // Preferred path: SECURITY DEFINER RPC (if created)
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

    // Fallback: direct insert (requires permissive RLS or service role)
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
        .select(
            "id, first_name, last_name, email, phone, updated_at, inserted_at, created_at"
        )
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
